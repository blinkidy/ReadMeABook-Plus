/**
 * Component: ntfy Notification Provider Tests
 * Documentation: documentation/backend/services/notifications.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from '../helpers/prisma';

const prismaMock = createPrismaMock();
prismaMock.notificationBackend = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as any;

const encryptionMock = vi.hoisted(() => ({
  encrypt: vi.fn((value: string) => `enc:${value}`),
  decrypt: vi.fn((value: string) => value.replace('enc:', '')),
  isEncryptedFormat: vi.fn((value: string) => typeof value === 'string' && value.startsWith('enc:')),
}));

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/services/encryption.service', () => ({
  getEncryptionService: () => encryptionMock,
}));

describe('NtfyProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('send', () => {
    it('sends notification to correct ntfy endpoint with JSON body', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg123' }),
      });

      const { NtfyProvider } = await import('@/lib/services/notification');
      const provider = new NtfyProvider();

      await provider.send(
        {
          serverUrl: 'https://ntfy.example.com',
          topic: 'audiobooks',
          accessToken: 'tk_mytoken123',
        },
        {
          event: 'request_approved',
          requestId: 'req-1',
          title: 'Test Book',
          author: 'Test Author',
          userName: 'Test User',
          timestamp: new Date('2024-01-01T00:00:00Z'),
        }
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const fetchCall = fetchMock.mock.calls[0];
      // ntfy JSON publishing: POST to base server URL, topic is in JSON body
      expect(fetchCall[0]).toBe('https://ntfy.example.com');
      expect(fetchCall[1].method).toBe('POST');
      expect(fetchCall[1].headers['Content-Type']).toBe('application/json');
      expect(fetchCall[1].headers['Authorization']).toBe('Bearer tk_mytoken123');

      const body = JSON.parse(fetchCall[1].body);
      expect(body.topic).toBe('audiobooks');
      expect(body.title).toBe('Request Approved');
      expect(body.message).toContain('Test Book');
      expect(body.message).toContain('Test Author');
      expect(body.message).toContain('Test User');
      expect(body.priority).toBe(3);
      expect(body.tags).toEqual(['white_check_mark']);
    });

    it('uses default server URL (https://ntfy.sh) when not provided', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg123' }),
      });

      const { NtfyProvider } = await import('@/lib/services/notification');
      const provider = new NtfyProvider();

      await provider.send(
        {
          topic: 'audiobooks',
        },
        {
          event: 'request_available',
          requestId: 'req-1',
          title: 'Test Book',
          author: 'Test Author',
          userName: 'Test User',
          timestamp: new Date(),
        }
      );

      const fetchCall = fetchMock.mock.calls[0];
      expect(fetchCall[0]).toBe('https://ntfy.sh');
    });

    it('does not include Authorization header when accessToken is not provided', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg123' }),
      });

      const { NtfyProvider } = await import('@/lib/services/notification');
      const provider = new NtfyProvider();

      await provider.send(
        {
          topic: 'audiobooks',
        },
        {
          event: 'request_approved',
          requestId: 'req-1',
          title: 'Test Book',
          author: 'Test Author',
          userName: 'Test User',
          timestamp: new Date(),
        }
      );

      const fetchCall = fetchMock.mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBeUndefined();
    });

    it('uses default priority based on event type when not configured', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg123' }),
      });

      const { NtfyProvider } = await import('@/lib/services/notification');
      const provider = new NtfyProvider();

      // request_error should default to priority 4 (high)
      await provider.send(
        { topic: 'audiobooks' },
        {
          event: 'request_error',
          requestId: 'req-1',
          title: 'Test Book',
          author: 'Test Author',
          userName: 'Test User',
          message: 'Download failed',
          timestamp: new Date(),
        }
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.priority).toBe(4);
      expect(body.tags).toEqual(['x']);
      expect(body.message).toContain('Download failed');
    });

    it('uses configured priority over default', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg123' }),
      });

      const { NtfyProvider } = await import('@/lib/services/notification');
      const provider = new NtfyProvider();

      await provider.send(
        { topic: 'audiobooks', priority: 5 },
        {
          event: 'request_approved',
          requestId: 'req-1',
          title: 'Test Book',
          author: 'Test Author',
          userName: 'Test User',
          timestamp: new Date(),
        }
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.priority).toBe(5);
    });

    it('strips trailing slashes from server URL', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg123' }),
      });

      const { NtfyProvider } = await import('@/lib/services/notification');
      const provider = new NtfyProvider();

      await provider.send(
        { serverUrl: 'https://ntfy.example.com/', topic: 'audiobooks' },
        {
          event: 'request_approved',
          requestId: 'req-1',
          title: 'Test Book',
          author: 'Test Author',
          userName: 'Test User',
          timestamp: new Date(),
        }
      );

      const fetchCall = fetchMock.mock.calls[0];
      expect(fetchCall[0]).toBe('https://ntfy.example.com');
    });

    it('throws descriptive error when API returns non-OK response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      });

      const { NtfyProvider } = await import('@/lib/services/notification');
      const provider = new NtfyProvider();

      await expect(
        provider.send(
          { topic: 'audiobooks', accessToken: 'bad_token' },
          {
            event: 'request_approved',
            requestId: 'req-1',
            title: 'Test Book',
            author: 'Test Author',
            userName: 'Test User',
            timestamp: new Date(),
          }
        )
      ).rejects.toThrow('ntfy API failed: 401 unauthorized');
    });

    it('includes error message in notification body for error events', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg123' }),
      });

      const { NtfyProvider } = await import('@/lib/services/notification');
      const provider = new NtfyProvider();

      await provider.send(
        { topic: 'audiobooks' },
        {
          event: 'request_error',
          requestId: 'req-1',
          title: 'Test Book',
          author: 'Test Author',
          userName: 'Test User',
          message: 'Download timed out',
          timestamp: new Date(),
        }
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.message).toContain('⚠️ Error: Download timed out');
    });
  });

  describe('messageLabel rendering by event', () => {
    const basePayload = {
      requestId: 'req-1',
      title: 'Test Book',
      author: 'Test Author',
      userName: 'Test User',
      timestamp: new Date('2024-01-01T00:00:00Z'),
    };

    it('renders "⚠️ Error:" with error emoji for request_error', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'msg' }) });
      const { NtfyProvider } = await import('@/lib/services/notification');
      const provider = new NtfyProvider();

      await provider.send(
        { topic: 'audiobooks' },
        { ...basePayload, event: 'request_error', message: 'Boom' }
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.message).toContain('⚠️ Error: Boom');
      expect(body.message).not.toContain('📝');
    });

    it('renders "📝 Reason:" with note emoji for issue_reported', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'msg' }) });
      const { NtfyProvider } = await import('@/lib/services/notification');
      const provider = new NtfyProvider();

      await provider.send(
        { topic: 'audiobooks' },
        { ...basePayload, event: 'issue_reported', issueId: 'iss-1', message: 'Chapter 3 cuts off' }
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.message).toContain('📝 Reason: Chapter 3 cuts off');
      expect(body.message).not.toContain('⚠️');
      expect(body.message).not.toContain('Error:');
    });

    it('renders "📝 Details:" with note emoji for request_grabbed', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'msg' }) });
      const { NtfyProvider } = await import('@/lib/services/notification');
      const provider = new NtfyProvider();

      await provider.send(
        { topic: 'audiobooks' },
        { ...basePayload, event: 'request_grabbed', message: 'Test Book [M4B] via NZBGeek (SABnzbd)', requestType: 'audiobook' }
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.message).toContain('📝 Details: Test Book [M4B] via NZBGeek (SABnzbd)');
      expect(body.message).not.toContain('⚠️');
      expect(body.message).not.toContain('Error:');
      expect(body.title).toBe('Audiobook Grabbed');
    });
  });

  describe('integration with NotificationService.sendToBackend', () => {
    it('decrypts accessToken and sends to ntfy', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg123' }),
      });

      const { NotificationService } = await import('@/lib/services/notification');
      const service = new NotificationService();

      await service.sendToBackend(
        'ntfy',
        {
          serverUrl: 'https://ntfy.example.com',
          topic: 'audiobooks',
          accessToken: 'enc:tk_mytoken123',
        },
        {
          event: 'request_approved',
          requestId: 'req-1',
          title: 'Test Book',
          author: 'Test Author',
          userName: 'Test User',
          timestamp: new Date(),
        }
      );

      // Verify decrypt was called for the sensitive field
      expect(encryptionMock.decrypt).toHaveBeenCalledWith('enc:tk_mytoken123');

      // Verify the decrypted value reaches the fetch call
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const fetchCall = fetchMock.mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBe('Bearer tk_mytoken123');
    });

    it('does not decrypt non-sensitive fields', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg123' }),
      });

      const { NotificationService } = await import('@/lib/services/notification');
      const service = new NotificationService();

      await service.sendToBackend(
        'ntfy',
        {
          serverUrl: 'https://ntfy.example.com',
          topic: 'audiobooks',
        },
        {
          event: 'request_approved',
          requestId: 'req-1',
          title: 'Test Book',
          author: 'Test Author',
          userName: 'Test User',
          timestamp: new Date(),
        }
      );

      // decrypt should not be called since there's no accessToken
      expect(encryptionMock.decrypt).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('encryptConfig and maskConfig', () => {
    it('encrypts accessToken', async () => {
      const { NotificationService } = await import('@/lib/services/notification');
      const service = new NotificationService();

      const encrypted = service.encryptConfig('ntfy', {
        serverUrl: 'https://ntfy.example.com',
        topic: 'audiobooks',
        accessToken: 'tk_mytoken123',
      });

      expect(encryptionMock.encrypt).toHaveBeenCalledWith('tk_mytoken123');
      expect(encrypted.accessToken).toBe('enc:tk_mytoken123');
      expect(encrypted.serverUrl).toBe('https://ntfy.example.com'); // Not encrypted
      expect(encrypted.topic).toBe('audiobooks'); // Not encrypted
    });

    it('masks accessToken', async () => {
      const { NotificationService } = await import('@/lib/services/notification');
      const service = new NotificationService();

      const masked = service.maskConfig('ntfy', {
        serverUrl: 'https://ntfy.example.com',
        topic: 'audiobooks',
        accessToken: 'tk_mytoken123',
      });

      expect(masked.accessToken).toBe('••••••••');
      expect(masked.serverUrl).toBe('https://ntfy.example.com'); // Not masked
      expect(masked.topic).toBe('audiobooks'); // Not masked
    });
  });
});
