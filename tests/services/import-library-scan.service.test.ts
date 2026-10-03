import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isPathWithinRoot,
  scanLibraryAfterImport,
} from '@/lib/services/import-library-scan.service';
import type { RMABLogger } from '@/lib/utils/logger';

const configServiceMock = vi.hoisted(() => ({
  get: vi.fn(),
  getBackendMode: vi.fn(),
}));
const triggerLibraryScanMock = vi.hoisted(() => vi.fn());
const triggerABSScanAfterImportMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/services/config.service', () => ({
  getConfigService: () => configServiceMock,
}));

vi.mock('@/lib/services/library', () => ({
  getLibraryService: async () => ({
    triggerLibraryScan: triggerLibraryScanMock,
  }),
}));

vi.mock('@/lib/services/audiobookshelf/api', () => ({
  triggerABSScanAfterImport: triggerABSScanAfterImportMock,
}));

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as RMABLogger;

describe('import library scan service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MEDIA_DIR;
    configServiceMock.get.mockImplementation(async (key: string) => {
      const values: Record<string, string> = {
        'audiobookshelf.trigger_scan_after_import': 'true',
        'audiobookshelf.library_id': 'abs-library',
        'plex.trigger_scan_after_import': 'true',
        'plex_audiobook_library_id': 'plex-library',
        'media_dir': '/media',
      };
      return values[key] ?? null;
    });
    triggerABSScanAfterImportMock.mockResolvedValue('scan-completed');
  });

  it('recognizes only the managed root and its descendants', () => {
    expect(isPathWithinRoot('/media/Craig Alanson/Paradise', '/media')).toBe(true);
    expect(isPathWithinRoot('/media', '/media')).toBe(true);
    expect(isPathWithinRoot('/media-other/Paradise', '/media')).toBe(false);
    expect(isPathWithinRoot('/bookorbit-drop/Paradise', '/media')).toBe(false);
  });

  it('requests an ABS scan for an audiobook imported into the managed media root', async () => {
    configServiceMock.getBackendMode.mockResolvedValue('audiobookshelf');

    await scanLibraryAfterImport('/media/Craig Alanson/Paradise B071438NCM', logger);

    expect(triggerABSScanAfterImportMock).toHaveBeenCalledWith('abs-library');
  });

  it('does not request an ABS scan for a BookOrbit-only EPUB import', async () => {
    configServiceMock.getBackendMode.mockResolvedValue('audiobookshelf');

    await scanLibraryAfterImport('/bookorbit-drop/Paradise', logger);

    expect(triggerABSScanAfterImportMock).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('outside managed media root'));
  });

  it('preserves ABS scanning for EPUBs intentionally imported under the managed media root', async () => {
    configServiceMock.getBackendMode.mockResolvedValue('audiobookshelf');

    await scanLibraryAfterImport('/media/Craig Alanson/Paradise EPUB', logger);

    expect(triggerABSScanAfterImportMock).toHaveBeenCalledWith('abs-library');
  });

  it('preserves the existing Plex scan behavior', async () => {
    configServiceMock.getBackendMode.mockResolvedValue('plex');

    await scanLibraryAfterImport('/bookorbit-drop/Paradise', logger);

    expect(triggerLibraryScanMock).toHaveBeenCalledWith('plex-library');
    expect(triggerABSScanAfterImportMock).not.toHaveBeenCalled();
  });
});
