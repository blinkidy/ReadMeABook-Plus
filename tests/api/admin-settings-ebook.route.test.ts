/**
 * Component: Admin E-book Settings Route Tests
 * Documentation: documentation/integrations/hardcover-search.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authRequest: any;

const requireAuthMock = vi.hoisted(() => vi.fn());
const requireAdminMock = vi.hoisted(() => vi.fn());
const configServiceMock = vi.hoisted(() => ({ setMany: vi.fn().mockResolvedValue(undefined) }));

vi.mock('@/lib/middleware/auth', () => ({
  requireAuth: requireAuthMock,
  requireAdmin: requireAdminMock,
}));

vi.mock('@/lib/services/config.service', () => ({
  getConfigService: () => configServiceMock,
}));

function makeRequest(body: any) {
  return { json: async () => body } as any;
}

describe('PUT /api/admin/settings/ebook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authRequest = {};
    requireAuthMock.mockImplementation((_req: any, handler: any) => handler(authRequest));
    requireAdminMock.mockImplementation((_req: any, handler: any) => handler());
  });

  it('saves a new Hardcover API key when provided', async () => {
    const { PUT } = await import('@/app/api/admin/settings/ebook/route');
    const response = await PUT(makeRequest({
      annasArchiveEnabled: false,
      indexerSearchEnabled: false,
      hardcoverSearchApiKey: 'real-hardcover-key',
    }));

    expect(response.status).toBe(200);
    expect(configServiceMock.setMany).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'hardcover_search_api_key', value: 'real-hardcover-key', encrypted: true }),
    ]);
  });

  it('does not overwrite the stored key when the UI sends back the masked placeholder', async () => {
    const { PUT } = await import('@/app/api/admin/settings/ebook/route');
    const response = await PUT(makeRequest({
      annasArchiveEnabled: false,
      indexerSearchEnabled: false,
      hardcoverSearchApiKey: '••••••••••••',
    }));

    expect(response.status).toBe(200);
    // Only the base ebook configs call, never a second call for the masked key
    expect(configServiceMock.setMany).toHaveBeenCalledTimes(1);
  });

  it('does not call setMany a second time when no Hardcover key is provided', async () => {
    const { PUT } = await import('@/app/api/admin/settings/ebook/route');
    const response = await PUT(makeRequest({
      annasArchiveEnabled: false,
      indexerSearchEnabled: false,
    }));

    expect(response.status).toBe(200);
    expect(configServiceMock.setMany).toHaveBeenCalledTimes(1);
  });
});
