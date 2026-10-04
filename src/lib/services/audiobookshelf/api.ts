/**
 * Component: Audiobookshelf API Client
 *
 * Provides API methods for interacting with Audiobookshelf:
 * - Library scanning and item fetching
 * - Metadata matching (with ASIN for accurate Audible lookup)
 * - Item management
 */

import { getConfigService } from '../config.service';
import { RMABLogger } from '@/lib/utils/logger';
import { AudibleRegion } from '@/lib/types/audible';

const logger = RMABLogger.create('Audiobookshelf');

/**
 * Map RMAB Audible region to Audiobookshelf provider value
 */
function mapRegionToABSProvider(region: AudibleRegion): string {
  // US uses 'audible' (audible.com), all others use 'audible.{region}'
  return region === 'us' ? 'audible' : `audible.${region}`;
}

interface ABSRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
}

/**
 * Make a request to the Audiobookshelf API
 */
export async function absRequest<T>(endpoint: string, options: ABSRequestOptions = {}): Promise<T> {
  const configService = getConfigService();
  const serverUrl = await configService.get('audiobookshelf.server_url');
  const apiToken = await configService.get('audiobookshelf.api_token');

  if (!serverUrl || !apiToken) {
    throw new Error('Audiobookshelf not configured');
  }

  const url = `${serverUrl.replace(/\/$/, '')}/api${endpoint}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`ABS API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get Audiobookshelf server status/info
 */
export async function getABSServerInfo() {
  return absRequest<{ version: string; name: string }>('/status');
}

/**
 * Get all libraries from Audiobookshelf
 */
export async function getABSLibraries() {
  const result = await absRequest<{ libraries: any[] }>('/libraries');
  return result.libraries;
}

interface ABSLibraryScanState {
  lastScan?: string | number | null;
  settings?: {
    disableWatcher?: boolean;
  };
}

interface ImportScanCoordinatorState {
  pending: boolean;
  promise: Promise<void>;
}

export type ABSImportScanResult = 'watcher-active' | 'scan-completed' | 'coalesced';

const IMPORT_SCAN_DEBOUNCE_MS = 250;
const SCAN_STATUS_POLL_MS = 1000;
const SCAN_STATUS_TIMEOUT_MS = 10 * 60 * 1000;
const importScanStates = new Map<string, ImportScanCoordinatorState>();

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function getABSLibraryScanState(libraryId: string): Promise<ABSLibraryScanState> {
  return absRequest<ABSLibraryScanState>(`/libraries/${libraryId}`);
}

async function waitForABSScanCompletion(
  libraryId: string,
  previousLastScan: string | number | null
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < SCAN_STATUS_TIMEOUT_MS) {
    await sleep(SCAN_STATUS_POLL_MS);
    const library = await getABSLibraryScanState(libraryId);
    const currentLastScan = library.lastScan ?? null;

    // Audiobookshelf updates lastScan only after the asynchronous scan finishes.
    if (currentLastScan !== null && currentLastScan !== previousLastScan) {
      return;
    }
  }

  throw new Error(`Timed out waiting for Audiobookshelf library ${libraryId} scan to finish`);
}

async function runCoordinatedImportScans(
  libraryId: string,
  state: ImportScanCoordinatorState
): Promise<void> {
  // Coalesce imports that finish in the same short burst before starting a scan.
  await sleep(IMPORT_SCAN_DEBOUNCE_MS);

  do {
    state.pending = false;
    const libraryBeforeScan = await getABSLibraryScanState(libraryId);
    const previousLastScan = libraryBeforeScan.lastScan ?? null;

    await triggerABSScan(libraryId);
    await waitForABSScanCompletion(libraryId, previousLastScan);

    // A request received while the scan was active sets pending=true. Run one
    // trailing scan so files that arrived after ABS enumerated the library are
    // not missed.
  } while (state.pending);
}

/**
 * Coordinate scans requested by completed imports.
 *
 * Audiobookshelf's watcher already queues filesystem changes, so a full scan
 * is unnecessary (and can race the watcher) while it is enabled. When the
 * watcher is disabled, requests are debounced per library and a trailing scan
 * is guaranteed for imports that arrive during an active scan.
 */
export async function triggerABSScanAfterImport(libraryId: string): Promise<ABSImportScanResult> {
  const library = await getABSLibraryScanState(libraryId);

  if (library.settings?.disableWatcher !== true) {
    return 'watcher-active';
  }

  const existingState = importScanStates.get(libraryId);
  if (existingState) {
    existingState.pending = true;
    await existingState.promise;
    return 'coalesced';
  }

  const state: ImportScanCoordinatorState = {
    pending: false,
    promise: Promise.resolve(),
  };

  state.promise = runCoordinatedImportScans(libraryId, state);
  importScanStates.set(libraryId, state);

  try {
    await state.promise;
    return 'scan-completed';
  } finally {
    if (importScanStates.get(libraryId) === state) {
      importScanStates.delete(libraryId);
    }
  }
}

/** Test-only reset for module-level coordinator state. */
export function resetABSImportScanCoordinator(): void {
  importScanStates.clear();
}

/**
 * Get all items in a library
 */
export async function getABSLibraryItems(libraryId: string) {
  const result = await absRequest<{ results: any[] }>(`/libraries/${libraryId}/items`);
  return result.results;
}

/**
 * Get recently added items in a library
 */
export async function getABSRecentItems(libraryId: string, limit: number) {
  const result = await absRequest<{ results: any[] }>(
    `/libraries/${libraryId}/items?sort=addedAt&desc=1&limit=${limit}`
  );
  return result.results;
}

/**
 * Get a single item by ID
 */
export async function getABSItem(itemId: string) {
  return absRequest<any>(`/items/${itemId}`);
}

/**
 * Search for items in a library
 */
export async function searchABSItems(libraryId: string, query: string) {
  const result = await absRequest<{ book: any[] }>(
    `/libraries/${libraryId}/search?q=${encodeURIComponent(query)}`
  );
  return result.book || [];
}

/**
 * Trigger a library scan
 * Note: This endpoint returns plain text "OK" instead of JSON
 */
export async function triggerABSScan(libraryId: string) {
  const configService = getConfigService();
  const serverUrl = await configService.get('audiobookshelf.server_url');
  const apiToken = await configService.get('audiobookshelf.api_token');

  if (!serverUrl || !apiToken) {
    throw new Error('Audiobookshelf not configured');
  }

  const url = `${serverUrl.replace(/\/$/, '')}/api/libraries/${libraryId}/scan`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ABS API error: ${response.status} ${response.statusText}`);
  }

  // Endpoint returns plain text "OK", not JSON - don't try to parse it
  await response.text();
}

/**
 * Trigger metadata match for a specific library item
 * This tells Audiobookshelf to automatically match and populate metadata from providers
 *
 * @param itemId - The Audiobookshelf item ID
 * @param asin - Optional ASIN for direct Audible matching (100% accurate when provided)
 */
export async function triggerABSItemMatch(itemId: string, asin?: string) {
  try {
    // Get configured Audible region to use correct ABS provider
    const configService = getConfigService();
    const region = await configService.getAudibleRegion();
    const provider = mapRegionToABSProvider(region);

    const body: any = {
      provider, // Use region-specific Audible provider (e.g., 'audible.ca' for Canada)
    };

    // If we have an ASIN, we can do a direct match with 100% confidence
    if (asin) {
      body.asin = asin;
      body.overrideDefaults = true; // Override defaults since we have exact ASIN match
    }

    await absRequest(`/items/${itemId}/match`, {
      method: 'POST',
      body,
    });
  } catch (error) {
    // Don't throw - matching is best-effort, scan should continue even if match fails
    logger.error(`Failed to trigger match for item ${itemId}`, { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Delete a library item from Audiobookshelf
 * Note: This only removes the item from Audiobookshelf's database, not the actual files
 *
 * @param itemId - The Audiobookshelf item ID to delete
 */
export async function deleteABSItem(itemId: string): Promise<void> {
  const configService = getConfigService();
  const serverUrl = await configService.get('audiobookshelf.server_url');
  const apiToken = await configService.get('audiobookshelf.api_token');

  if (!serverUrl || !apiToken) {
    throw new Error('Audiobookshelf not configured');
  }

  const url = `${serverUrl.replace(/\/$/, '')}/api/items/${itemId}?hard=1`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`ABS API error: ${response.status} ${response.statusText}`);
  }

  logger.info(`Deleted library item ${itemId} from Audiobookshelf`);
}
