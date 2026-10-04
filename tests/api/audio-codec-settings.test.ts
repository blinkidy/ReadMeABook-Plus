import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/admin/settings/indexer-options/route';

const config = vi.hoisted(() => ({ get: vi.fn(), setMany: vi.fn(), clearCache: vi.fn() }));
vi.mock('@/lib/services/config.service', () => ({ getConfigService: () => config }));
vi.mock('@/lib/middleware/auth', () => ({
  requireAuth: (request: unknown, handler: (request: unknown) => unknown) => handler(request),
  requireAdmin: (_request: unknown, handler: () => unknown) => handler(),
}));
function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/settings/indexer-options', {
    method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });
}

describe('codec penalty settings', () => {
  beforeEach(() => { vi.clearAllMocks(); config.get.mockResolvedValue(null); });
  it('returns the default and the saved codec penalty', async () => {
    expect(await (await GET(request({}))).json()).toMatchObject({ xheAacPenalty: 100 });
    config.get.mockImplementation(async (key: string) => key === 'indexer.xhe_aac_penalty' ? '60' : null);
    expect(await (await GET(request({}))).json()).toMatchObject({ xheAacPenalty: 60 });
  });
  it.each([0, 60, 100])('persists penalty %s', async penalty => {
    expect((await PUT(request({ skipUnreleased: true, xheAacPenalty: penalty }))).status).toBe(200);
    expect(config.setMany).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ key: 'indexer.xhe_aac_penalty', value: String(penalty) }),
    ]));
  });
  it.each([-1, 101, '60', null])('rejects invalid penalty %s before writing settings', async penalty => {
    expect((await PUT(request({ skipUnreleased: true, xheAacPenalty: penalty }))).status).toBe(400);
    expect(config.setMany).not.toHaveBeenCalled();
  });
  it('preserves the stored penalty when older clients omit it', async () => {
    await PUT(request({ skipUnreleased: false }));
    expect(config.setMany).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'indexer.skip_unreleased', value: 'false' }),
    ]);
  });
});
