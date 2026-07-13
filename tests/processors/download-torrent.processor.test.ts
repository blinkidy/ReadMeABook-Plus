/**
 * Component: Download Torrent Processor Tests
 * Documentation: documentation/backend/services/jobs.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from '../helpers/prisma';
import { createJobQueueMock } from '../helpers/job-queue';

const prismaMock = createPrismaMock();
const configMock = vi.hoisted(() => ({
  get: vi.fn(),
  getMany: vi.fn().mockResolvedValue({ prowlarr_api_key: null }),
}));
const jobQueueMock = createJobQueueMock();
const qbtMock = vi.hoisted(() => ({ addTorrent: vi.fn() }));
const sabMock = vi.hoisted(() => ({ addNZB: vi.fn() }));

const downloadClientManagerMock = vi.hoisted(() => ({
  getClientForProtocol: vi.fn(),
  getClientServiceForProtocol: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/services/config.service', () => ({
  getConfigService: () => configMock,
}));

vi.mock('@/lib/services/download-client-manager.service', () => ({
  getDownloadClientManager: () => downloadClientManagerMock,
}));

vi.mock('@/lib/services/job-queue.service', () => ({
  getJobQueueService: () => jobQueueMock,
}));

vi.mock('@/lib/integrations/qbittorrent.service', () => ({
  getQBittorrentService: () => qbtMock,
}));

vi.mock('@/lib/integrations/sabnzbd.service', () => ({
  getSABnzbdService: () => sabMock,
}));

vi.mock('@/lib/integrations/prowlarr.service', () => ({
  ProwlarrService: {
    isNZBResult: vi.fn((result: any) => {
      // Detect NZB by URL pattern or protocol field
      return result.downloadUrl?.endsWith('.nzb') || result.protocol === 'usenet';
    }),
  },
}));

describe('processDownloadTorrent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default implementations cleared by clearAllMocks
    configMock.getMany.mockResolvedValue({ prowlarr_api_key: null });
    jobQueueMock.addNotificationJob.mockResolvedValue(undefined);
  });

  const torrentPayload = {
    requestId: 'req-1',
    audiobook: { id: 'a1', title: 'Book', author: 'Author' },
    torrent: {
      indexer: 'Indexer',
      indexerId: 1,
      title: 'Book - Author',
      size: 50 * 1024 * 1024,
      seeders: 10,
      publishDate: new Date(),
      downloadUrl: 'magnet:?xt=urn:btih:abc',
      guid: 'guid-1',
      format: 'M4B',
      protocol: 'torrent',
    },
    jobId: 'job-1',
  };

  const nzbPayload = {
    requestId: 'req-2',
    audiobook: { id: 'a2', title: 'Book2', author: 'Author2' },
    torrent: {
      indexer: 'UsenetIndexer',
      indexerId: 2,
      title: 'Book2 - Author2',
      size: 100 * 1024 * 1024,
      seeders: 0,
      publishDate: new Date(),
      downloadUrl: 'http://indexer.com/download/file.nzb',
      guid: 'guid-2',
      format: 'M4B',
      protocol: 'usenet',
    },
    jobId: 'job-2',
  };

  it('routes torrent downloads to qBittorrent', async () => {
    const qbtClientMock = {
      clientType: 'qbittorrent',
      protocol: 'torrent',
      addDownload: vi.fn().mockResolvedValue('hash-1'),
    };
    downloadClientManagerMock.getClientServiceForProtocol.mockResolvedValue(qbtClientMock);
    downloadClientManagerMock.getClientForProtocol.mockResolvedValue({
      id: 'client-1',
      type: 'qbittorrent',
      enabled: true,
      category: 'readmeabook',
    });
    prismaMock.request.update.mockResolvedValue({ type: 'audiobook', user: { plexUsername: 'testuser' } });
    prismaMock.downloadHistory.create.mockResolvedValue({ id: 'dh-1' });

    const { processDownloadTorrent } = await import('@/lib/processors/download-torrent.processor');
    const result = await processDownloadTorrent(torrentPayload);

    expect(result.success).toBe(true);
    expect(downloadClientManagerMock.getClientServiceForProtocol).toHaveBeenCalledWith('torrent');
    expect(qbtClientMock.addDownload).toHaveBeenCalled();
    expect(jobQueueMock.addMonitorJob).toHaveBeenCalledWith(
      'req-1',
      'dh-1',
      'hash-1',
      'qbittorrent',
      3
    );
  });

  it('routes NZB downloads to SABnzbd', async () => {
    const sabClientMock = {
      clientType: 'sabnzbd',
      protocol: 'usenet',
      addDownload: vi.fn().mockResolvedValue('nzb-1'),
    };
    downloadClientManagerMock.getClientServiceForProtocol.mockResolvedValue(sabClientMock);
    downloadClientManagerMock.getClientForProtocol.mockResolvedValue({
      id: 'client-2',
      type: 'sabnzbd',
      enabled: true,
      category: 'readmeabook',
    });
    prismaMock.request.update.mockResolvedValue({ type: 'audiobook', user: { plexUsername: 'testuser' } });
    prismaMock.downloadHistory.create.mockResolvedValue({ id: 'dh-2' });

    const { processDownloadTorrent } = await import('@/lib/processors/download-torrent.processor');
    const result = await processDownloadTorrent(nzbPayload);

    expect(result.success).toBe(true);
    expect(downloadClientManagerMock.getClientServiceForProtocol).toHaveBeenCalledWith('usenet');
    expect(sabClientMock.addDownload).toHaveBeenCalled();
    expect(jobQueueMock.addMonitorJob).toHaveBeenCalledWith(
      'req-2',
      'dh-2',
      'nzb-1',
      'sabnzbd',
      3
    );
  });

  it('throws error when no client configured for protocol', async () => {
    downloadClientManagerMock.getClientServiceForProtocol.mockResolvedValue(null);
    prismaMock.request.update.mockResolvedValue({});

    const { processDownloadTorrent } = await import('@/lib/processors/download-torrent.processor');

    await expect(processDownloadTorrent(torrentPayload)).rejects.toThrow(
      'No torrent download client configured'
    );

    expect(downloadClientManagerMock.getClientServiceForProtocol).toHaveBeenCalledWith('torrent');
  });

  it('detects protocol from result and routes appropriately', async () => {
    // Torrent result
    const qbtClientMock = {
      clientType: 'qbittorrent',
      protocol: 'torrent',
      addDownload: vi.fn().mockResolvedValue('hash-1'),
    };
    downloadClientManagerMock.getClientServiceForProtocol.mockResolvedValueOnce(qbtClientMock);
    downloadClientManagerMock.getClientForProtocol.mockResolvedValueOnce({
      id: 'client-1',
      type: 'qbittorrent',
      enabled: true,
      category: 'readmeabook',
    });
    prismaMock.request.update.mockResolvedValue({ type: 'audiobook', user: { plexUsername: 'testuser' } });
    prismaMock.downloadHistory.create.mockResolvedValue({ id: 'dh-1' });

    const { processDownloadTorrent } = await import('@/lib/processors/download-torrent.processor');
    await processDownloadTorrent(torrentPayload);

    expect(downloadClientManagerMock.getClientServiceForProtocol).toHaveBeenCalledWith('torrent');

    // NZB result
    const sabClientMock = {
      clientType: 'sabnzbd',
      protocol: 'usenet',
      addDownload: vi.fn().mockResolvedValue('nzb-1'),
    };
    downloadClientManagerMock.getClientServiceForProtocol.mockResolvedValueOnce(sabClientMock);
    downloadClientManagerMock.getClientForProtocol.mockResolvedValueOnce({
      id: 'client-2',
      type: 'sabnzbd',
      enabled: true,
      category: 'readmeabook',
    });
    prismaMock.downloadHistory.create.mockResolvedValue({ id: 'dh-2' });

    await processDownloadTorrent(nzbPayload);

    expect(downloadClientManagerMock.getClientServiceForProtocol).toHaveBeenCalledWith('usenet');
  });

  describe('candidate fallback', () => {
    const closeCandidate = {
      indexer: 'IndexerB',
      indexerId: 2,
      title: 'Book - Author (alt)',
      size: 48 * 1024 * 1024,
      seeders: 8,
      publishDate: new Date(),
      downloadUrl: 'magnet:?xt=urn:btih:def',
      guid: 'guid-alt',
      format: 'M4B',
      protocol: 'torrent',
      score: 91,
      finalScore: 101.8,
    };

    const farCandidate = {
      ...closeCandidate,
      guid: 'guid-far',
      title: 'Book - Author (poor match)',
      score: 40,
      finalScore: 55,
    };

    const payloadWithCandidates = {
      ...torrentPayload,
      torrent: { ...torrentPayload.torrent, score: 91, finalScore: 101.9 },
      candidates: [closeCandidate, farCandidate],
    };

    function mockQbtClient(addDownload: ReturnType<typeof vi.fn>) {
      const qbtClientMock = { clientType: 'qbittorrent', protocol: 'torrent', addDownload };
      downloadClientManagerMock.getClientServiceForProtocol.mockResolvedValue(qbtClientMock);
      downloadClientManagerMock.getClientForProtocol.mockResolvedValue({
        id: 'client-1',
        type: 'qbittorrent',
        enabled: true,
        category: 'readmeabook',
      });
    }

    it('falls back to a close-scoring candidate when the top result fails for a non-transient reason', async () => {
      const addDownload = vi.fn()
        .mockRejectedValueOnce(new Error('Failed to download torrent: HTTP 501'))
        .mockResolvedValueOnce('hash-alt');
      mockQbtClient(addDownload);
      prismaMock.request.update.mockResolvedValue({ type: 'audiobook', user: { plexUsername: 'testuser' } });
      prismaMock.downloadHistory.create.mockResolvedValue({ id: 'dh-alt' });

      const { processDownloadTorrent } = await import('@/lib/processors/download-torrent.processor');
      const result = await processDownloadTorrent(payloadWithCandidates);

      expect(result.success).toBe(true);
      expect(addDownload).toHaveBeenCalledTimes(2);
      // The successful attempt used the close candidate's download URL
      expect(addDownload).toHaveBeenLastCalledWith('magnet:?xt=urn:btih:def', expect.anything());
      expect(prismaMock.request.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) })
      );
    });

    it('does not fall back to a candidate scored far below the original pick', async () => {
      const addDownload = vi.fn().mockRejectedValue(new Error('Failed to download torrent: HTTP 501'));
      mockQbtClient(addDownload);
      prismaMock.request.update.mockResolvedValue({ type: 'audiobook', user: { plexUsername: 'testuser' } });

      const payloadOnlyFarCandidate = {
        ...torrentPayload,
        torrent: { ...torrentPayload.torrent, score: 91, finalScore: 101.9 },
        candidates: [farCandidate],
      };

      const { processDownloadTorrent } = await import('@/lib/processors/download-torrent.processor');
      await expect(processDownloadTorrent(payloadOnlyFarCandidate)).rejects.toThrow('HTTP 501');

      // Only the original result was attempted — the poor-scoring candidate was skipped
      expect(addDownload).toHaveBeenCalledTimes(1);
      expect(prismaMock.request.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) })
      );
    });

    it('blocks failing releases and queues a fresh ebook search when all attempts fail', async () => {
      const addDownload = vi.fn().mockRejectedValue(new Error('Failed to download torrent: HTTP 500'));
      mockQbtClient(addDownload);
      prismaMock.request.update.mockResolvedValue({ type: 'ebook', user: { plexUsername: 'testuser' } });
      prismaMock.blockedRelease.upsert.mockResolvedValue({ createdAt: new Date() });
      prismaMock.blockedRelease.count.mockResolvedValue(2);
      prismaMock.request.findUnique.mockResolvedValue({
        id: 'req-1',
        type: 'ebook',
        audiobook: { audibleAsin: 'ASIN-1' },
      });

      const { processDownloadTorrent } = await import('@/lib/processors/download-torrent.processor');
      const result = await processDownloadTorrent(payloadWithCandidates);

      // Original + close candidate attempted (far candidate gated by score)
      expect(addDownload).toHaveBeenCalledTimes(2);
      // Both failing releases were grab-blocked with the indexer recorded
      expect(prismaMock.blockedRelease.upsert).toHaveBeenCalledTimes(2);
      expect(prismaMock.blockedRelease.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            source: 'grab_fail',
            indexerId: 1,
            reasonDetail: expect.stringContaining('HTTP 500'),
          }),
        })
      );
      // Request went back to pending and a fresh ebook search was queued
      expect(prismaMock.request.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'pending' }) })
      );
      expect(jobQueueMock.addSearchEbookJob).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({ asin: 'ASIN-1' })
      );
      expect(prismaMock.request.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) })
      );
      expect(result.requeued).toBe(true);
    });

    it('queues an audiobook search for audiobook requests after grab failure', async () => {
      const addDownload = vi.fn().mockRejectedValue(new Error('Failed to download torrent: HTTP 500'));
      mockQbtClient(addDownload);
      prismaMock.request.update.mockResolvedValue({ type: 'audiobook', user: { plexUsername: 'testuser' } });
      prismaMock.blockedRelease.upsert.mockResolvedValue({ createdAt: new Date() });
      prismaMock.blockedRelease.count.mockResolvedValue(1);
      prismaMock.request.findUnique.mockResolvedValue({
        id: 'req-1',
        type: 'audiobook',
        audiobook: { audibleAsin: 'ASIN-2' },
      });

      const { processDownloadTorrent } = await import('@/lib/processors/download-torrent.processor');
      const result = await processDownloadTorrent(payloadWithCandidates);

      expect(jobQueueMock.addSearchJob).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({ asin: 'ASIN-2' })
      );
      expect(jobQueueMock.addSearchEbookJob).not.toHaveBeenCalled();
      expect(result.requeued).toBe(true);
    });

    it('fails the request for real once the grab-fail re-search budget is exhausted', async () => {
      const addDownload = vi.fn().mockRejectedValue(new Error('Failed to download torrent: HTTP 500'));
      mockQbtClient(addDownload);
      prismaMock.request.update.mockResolvedValue({ type: 'ebook', user: { plexUsername: 'testuser' } });
      prismaMock.blockedRelease.upsert.mockResolvedValue({ createdAt: new Date() });
      prismaMock.blockedRelease.count.mockResolvedValue(7); // over MAX_GRAB_FAIL_BLOCKS

      const { processDownloadTorrent } = await import('@/lib/processors/download-torrent.processor');
      await expect(processDownloadTorrent(payloadWithCandidates)).rejects.toThrow('HTTP 500');

      expect(jobQueueMock.addSearchEbookJob).not.toHaveBeenCalled();
      expect(jobQueueMock.addSearchJob).not.toHaveBeenCalled();
      expect(prismaMock.request.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) })
      );
    });

    it('stops trying candidates and lets Bull retry on a transient connection error', async () => {
      const connectionError = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      const addDownload = vi.fn().mockRejectedValue(connectionError);
      mockQbtClient(addDownload);
      prismaMock.request.update.mockResolvedValue({ type: 'audiobook', user: { plexUsername: 'testuser' } });

      const { processDownloadTorrent } = await import('@/lib/processors/download-torrent.processor');
      await expect(processDownloadTorrent(payloadWithCandidates)).rejects.toThrow('ECONNREFUSED');

      // Bails immediately on the first transient error, no fallback attempts
      expect(addDownload).toHaveBeenCalledTimes(1);
      expect(prismaMock.request.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) })
      );
    });
  });
});
