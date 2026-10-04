import path from 'path';
import { getConfigService } from './config.service';
import { getLibraryService } from './library';
import { triggerABSScanAfterImport } from './audiobookshelf/api';
import type { RMABLogger } from '../utils/logger';

function getPathImplementation(...paths: string[]): typeof path.posix | typeof path.win32 {
  return paths.some(value => /^[a-zA-Z]:[\\/]/.test(value) || value.includes('\\'))
    ? path.win32
    : path.posix;
}

/** Return true only when targetPath is the root itself or one of its descendants. */
export function isPathWithinRoot(targetPath: string, rootPath: string): boolean {
  const pathImpl = getPathImplementation(targetPath, rootPath);
  const resolvedTarget = pathImpl.resolve(targetPath);
  const resolvedRoot = pathImpl.resolve(rootPath);
  const relativePath = pathImpl.relative(resolvedRoot, resolvedTarget);

  return relativePath === '' || (
    relativePath !== '..' &&
    !relativePath.startsWith(`..${pathImpl.sep}`) &&
    !pathImpl.isAbsolute(relativePath)
  );
}

/**
 * Trigger the configured library backend after an import.
 *
 * Plex retains its existing scan behavior. Audiobookshelf scans are restricted
 * to files placed in ReadMeABook's managed media root; BookOrbit's ingest root
 * is intentionally outside that library.
 */
export async function scanLibraryAfterImport(targetPath: string, logger: RMABLogger): Promise<void> {
  const configService = getConfigService();
  const backendMode = await configService.getBackendMode();
  const configKey = backendMode === 'audiobookshelf'
    ? 'audiobookshelf.trigger_scan_after_import'
    : 'plex.trigger_scan_after_import';
  const scanEnabled = await configService.get(configKey);

  if (scanEnabled !== 'true') {
    logger.info(`${backendMode} filesystem scan trigger disabled (relying on filesystem watcher)`);
    return;
  }

  try {
    const libraryId = backendMode === 'audiobookshelf'
      ? await configService.get('audiobookshelf.library_id')
      : await configService.get('plex_audiobook_library_id');

    if (!libraryId) {
      throw new Error('Library ID not configured');
    }

    if (backendMode === 'audiobookshelf') {
      const mediaRoot = await configService.get('media_dir')
        || process.env.MEDIA_DIR
        || '/media/audiobooks';

      if (!isPathWithinRoot(targetPath, mediaRoot)) {
        logger.info(
          `Skipping Audiobookshelf scan because import destination ${targetPath} is outside managed media root ${mediaRoot}`
        );
        return;
      }

      const result = await triggerABSScanAfterImport(libraryId);
      if (result === 'watcher-active') {
        logger.info(
          `Audiobookshelf watcher is active for library ${libraryId}; skipping redundant full scan`
        );
      } else if (result === 'coalesced') {
        logger.info(`Coalesced Audiobookshelf import scan for library ${libraryId}`);
      } else {
        logger.info(`Completed coordinated Audiobookshelf scan for library ${libraryId}`);
      }
      return;
    }

    const libraryService = await getLibraryService();
    await libraryService.triggerLibraryScan(libraryId);
    logger.info(`Triggered ${backendMode} filesystem scan for library ${libraryId}`);
  } catch (error) {
    logger.error(
      `Failed to trigger filesystem scan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      {
        error: error instanceof Error ? error.stack : undefined,
        backend: backendMode,
      }
    );
  }
}
