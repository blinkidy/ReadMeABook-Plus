/**
 * Component: Download Job Processor
 * Documentation: documentation/phase3/README.md
 */

import { DownloadTorrentPayload, getJobQueueService } from '../services/job-queue.service';
import { prisma } from '../db';
import { getConfigService } from '../services/config.service';
import { getDownloadClientManager } from '../services/download-client-manager.service';
import { ProwlarrService } from '../integrations/prowlarr.service';
import { RMABLogger } from '../utils/logger';
import { isTransientConnectionError } from '../utils/connection-errors';
import type { TorrentResult } from '../utils/ranking-algorithm';

// A fallback candidate must score within this many points of the originally
// selected result to be attempted — keeps a bad link/indexer from silently
// sliding the download down to a much lower-quality pick.
const MAX_FALLBACK_SCORE_DROP = 10;
// Total results tried (including the original selection) before giving up.
const MAX_DOWNLOAD_ATTEMPTS = 3;

type JobLogger = ReturnType<typeof RMABLogger.forJob>;

function resultScore(result: TorrentResult): number {
  const withScore = result as TorrentResult & { finalScore?: number; score?: number };
  return withScore.finalScore ?? withScore.score ?? 0;
}

/**
 * Attempt to add a single result to the appropriate download client.
 * Throws on failure — the caller decides whether to fall back to the next
 * candidate or let Bull retry (transient client-connectivity errors).
 */
async function attemptAddDownload(
  requestId: string,
  audiobook: { id: string; title: string; author: string },
  torrent: TorrentResult,
  logger: JobLogger
): Promise<any> {
  // Update request status to downloading
  const request = await prisma.request.update({
    where: { id: requestId },
    data: {
      status: 'downloading',
      progress: 0,
      updatedAt: new Date(),
    },
    include: {
      user: { select: { plexUsername: true } },
    },
  });

  // Detect protocol from result and get appropriate client
  const isUsenet = ProwlarrService.isNZBResult(torrent);
  const protocol = isUsenet ? 'usenet' : 'torrent';
  const config = await getConfigService();
  const manager = getDownloadClientManager(config);

  const client = await manager.getClientServiceForProtocol(protocol);

  if (!client) {
    throw new Error(`No ${protocol} download client configured. Please add a ${protocol} client in Settings > Download Clients.`);
  }

  // Get client config for category
  const clientConfig = await manager.getClientForProtocol(protocol);
  const category = clientConfig?.category || 'readmeabook';

  logger.info(`Routing to ${client.clientType} (${client.protocol})`);

  // Include Prowlarr API key as source header so NZB/torrent downloads from
  // Prowlarr proxy URLs are authenticated (fixes 403 for indexers like NZBFinder)
  const prowlarrApiKey = (await config.getMany(['prowlarr_api_key'])).prowlarr_api_key || process.env.PROWLARR_API_KEY;
  const sourceHeaders: Record<string, string> = {};
  if (prowlarrApiKey) {
    sourceHeaders['X-Api-Key'] = prowlarrApiKey;
  }

  // Add download via unified interface
  const downloadClientId = await client.addDownload(torrent.downloadUrl, {
    category,
    priority: 'normal',
    sourceHeaders,
  });

  logger.info(`Download added with ID: ${downloadClientId}`);

  // Create DownloadHistory record
  // Determine indexer page URL - exclude magnet links from guid fallback
  const indexerPageUrl = torrent.infoUrl || (torrent.guid?.startsWith('magnet:') ? null : torrent.guid);

  const downloadHistory = await prisma.downloadHistory.create({
    data: {
      requestId,
      indexerName: torrent.indexer,
      indexerId: torrent.indexerId,
      downloadClient: client.clientType,
      downloadClientId,
      torrentName: torrent.title,
      // Set protocol-specific ID fields for backward compatibility
      torrentHash: client.protocol === 'torrent' ? (torrent.infoHash || downloadClientId) : undefined,
      nzbId: client.protocol === 'usenet' ? downloadClientId : undefined,
      torrentSizeBytes: torrent.size,
      torrentUrl: indexerPageUrl,
      magnetLink: torrent.downloadUrl,
      seeders: torrent.seeders || 0,
      leechers: torrent.leechers || 0,
      downloadStatus: 'downloading',
      selected: true,
      startedAt: new Date(),
    },
  });

  logger.info(`Created download history record: ${downloadHistory.id}`);

  // Send grab notification (non-blocking — failures here don't fail the download)
  const jobQueue = getJobQueueService();
  const grabMessage = `${torrent.title} via ${torrent.indexer} (${client.clientType})`;
  await jobQueue.addNotificationJob(
    'request_grabbed',
    requestId,
    audiobook.title,
    audiobook.author,
    request.user.plexUsername || 'Unknown User',
    grabMessage,
    request.type
  ).catch((error) => {
    logger.error('Failed to queue grab notification', { error: error instanceof Error ? error.message : String(error) });
  });

  // Trigger monitor download job with initial delay
  await jobQueue.addMonitorJob(
    requestId,
    downloadHistory.id,
    downloadClientId,
    client.clientType,
    3 // Wait 3 seconds before first check
  );

  logger.info(`Started monitoring job for request ${requestId} (${client.clientType}, 3s initial delay)`);

  return {
    success: true,
    message: `Download added to ${client.clientType} and monitoring started`,
    requestId,
    downloadHistoryId: downloadHistory.id,
    downloadClientId,
    torrent: {
      title: torrent.title,
      size: torrent.size,
      seeders: torrent.seeders || 0,
      format: torrent.format,
    },
  };
}

/**
 * Process download job
 * Routes to appropriate download client based on protocol detection.
 * If the selected result fails for an indexer/link reason (not a download
 * client connectivity issue), falls back to the next-ranked candidate as
 * long as its score is close to the original pick — see MAX_FALLBACK_SCORE_DROP.
 */
export async function processDownloadTorrent(payload: DownloadTorrentPayload): Promise<any> {
  const { requestId, audiobook, torrent, candidates, jobId } = payload;

  const logger = RMABLogger.forJob(jobId, 'DownloadTorrent');

  logger.info(`Processing request ${requestId} for "${audiobook.title}"`);
  logger.info(`Selected result: ${torrent.title}`, {
    size: torrent.size,
    seeders: torrent.seeders,
    format: torrent.format,
    indexer: torrent.indexer,
  });

  const topScore = resultScore(torrent);
  const qualifyingCandidates = (candidates || [])
    .filter((candidate) => resultScore(candidate) >= topScore - MAX_FALLBACK_SCORE_DROP)
    .slice(0, MAX_DOWNLOAD_ATTEMPTS - 1);

  const attempts = [torrent, ...qualifyingCandidates];
  let lastError: unknown;

  for (let i = 0; i < attempts.length; i++) {
    const candidate = attempts[i];
    try {
      if (i > 0) {
        logger.warn(
          `Falling back to alternative result ${i + 1}/${attempts.length}: "${candidate.title}" ` +
          `(score ${Math.round(resultScore(candidate))}) from ${candidate.indexer}`
        );
      }
      return await attemptAddDownload(requestId, audiobook, candidate, logger);
    } catch (error) {
      lastError = error;

      if (isTransientConnectionError(error)) {
        // Download client itself is unreachable — trying other candidates
        // won't help. Let Bull retry this same job (3 attempts, exponential
        // backoff); if all retries are exhausted, the global failed handler
        // marks the request failed.
        logger.warn(`Download client unreachable for request ${requestId}, allowing Bull to retry`);
        throw error;
      }

      logger.error(
        `Result ${i + 1}/${attempts.length} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Every result we were willing to try (original selection + close-scoring
  // fallbacks) failed for a non-transient (indexer/link) reason.
  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: 'failed',
      errorMessage: lastError instanceof Error ? lastError.message : 'Failed to add download to client',
      updatedAt: new Date(),
    },
  });

  throw lastError;
}
