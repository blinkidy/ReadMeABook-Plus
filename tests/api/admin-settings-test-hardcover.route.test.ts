/**
 * Component: Hardcover Connection Test Route Tests
 * Documentation: documentation/integrations/hardcover-search.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

let authRequest: any;

const requireAuthMock = vi.hoisted(() => vi.fn());
const requireAdminMock = vi.hoisted(() => vi.fn());
const searchHardcoverBooksMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/middleware/auth', () => ({
  requireAuth: requireAuthMock,
  requireAdmin: requireAdminMock,
}));

vi.mock('@/lib/services/hardcover-api.service', () => ({
  searchHardcoverBooks: searchHardcoverBooksMock,
}));

function makeRequest(body: any) {
  return { json: async () => body } as any;
}

describe('POST /api/admin/settings/ebook/test-hardcover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authRequest = {};
    requireAuthMock.mockImplementation((_req: any, handler: any) => handler(authRequest));
    requireAdminMock.mockImplementation((_req: any, handler: any) => handler());
  });

  it('returns success when the key is valid', async () => {
    searchHardcoverBooksMock.mockResolvedValue({ books: [{ hardcoverId: '1', title: 'A', author: 'B' }], found: 1 });

    const { POST } = await import('@/app/api/admin/settings/ebook/test-hardcover/route');
    const response = await POST(makeRequest({ apiKey: 'real-key' }));
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(searchHardcoverBooksMock).toHaveBeenCalledWith('real-key', 'test', 1);
  });

  it('returns failure when the API rejects the key', async () => {
    searchHardcoverBooksMock.mockRejectedValue(new Error('Hardcover API Error: invalid token'));

    const { POST } = await import('@/app/api/admin/settings/ebook/test-hardcover/route');
    const response = await POST(makeRequest({ apiKey: 'bad-key' }));
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.message).toContain('invalid token');
  });

  it('rejects a missing key without calling the API', async () => {
    const { POST } = await import('@/app/api/admin/settings/ebook/test-hardcover/route');
    const response = await POST(makeRequest({ apiKey: '' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(searchHardcoverBooksMock).not.toHaveBeenCalled();
  });

  it('rejects the masked placeholder without calling the API', async () => {
    const { POST } = await import('@/app/api/admin/settings/ebook/test-hardcover/route');
    const response = await POST(makeRequest({ apiKey: '••••••••••••' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(searchHardcoverBooksMock).not.toHaveBeenCalled();
  });
});
