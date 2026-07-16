/**
 * Component: Audiobook Details Modal Tests
 * Documentation: documentation/frontend/components.md
 */

// @vitest-environment jsdom

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useAuthMock = vi.hoisted(() => vi.fn());
const useAudiobookDetailsMock = vi.hoisted(() => vi.fn());
const useEbookStatusMock = vi.hoisted(() => vi.fn());
const createRequestMock = vi.hoisted(() => vi.fn());
const revalidateEbookStatusMock = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ squareCovers: false, setSquareCovers: vi.fn(), cardSize: 5, setCardSize: vi.fn() }),
}));

vi.mock('@/lib/hooks/useAudiobooks', () => ({
  useAudiobookDetails: (asin: string | null) => useAudiobookDetailsMock(asin),
}));

vi.mock('@/lib/hooks/useRequests', () => ({
  useCreateRequest: () => ({ createRequest: createRequestMock, isLoading: false }),
  useEbookStatus: () => useEbookStatusMock(),
  useDownloadStatus: () => ({ downloadAvailable: false, requestId: null }),
}));

vi.mock('@/components/requests/InteractiveTorrentSearchModal', () => ({
  InteractiveTorrentSearchModal: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="interactive-modal" data-open={String(isOpen)} />
  ),
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

const audiobookDetails = {
  asin: 'ASIN123',
  title: 'Detail Book',
  author: 'Detail Author',
  description: 'Summary',
  rating: 4.2,
  durationMinutes: 320,
  releaseDate: '2023-01-01',
  genres: ['Fantasy'],
};

describe('AudiobookDetailsModal', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ user: { id: 'user-1', username: 'user' } });
    useAudiobookDetailsMock.mockReturnValue({
      audiobook: audiobookDetails,
      isLoading: false,
      error: null,
    });
    useEbookStatusMock.mockReturnValue({
      ebookStatus: null,
      revalidate: revalidateEbookStatusMock,
    });
    createRequestMock.mockReset();
    revalidateEbookStatusMock.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders audiobook details and closes when requested', async () => {
    const onClose = vi.fn();
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={onClose}
      />
    );

    await act(async () => {});
    expect(screen.getByText('Detail Book')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    // Both mobile and desktop close buttons exist, click the first one
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Hardcover page count, ISBN, and source link when enriched', async () => {
    useAudiobookDetailsMock.mockReturnValue({
      audiobook: audiobookDetails,
      hardcover: {
        id: '123',
        pageCount: 336,
        isbn: '9780000000001',
        url: 'https://hardcover.app/books/detail-book',
        rating: 4.18,
        ratingsCount: 4200,
        reviewsCount: 610,
        reviews: [
          {
            id: 'review-1',
            rating: 4.5,
            text: 'An excellent space opera.',
            hasSpoilers: false,
            likesCount: 42,
            reviewer: 'Reader One',
          },
          {
            id: 'review-2',
            rating: 4,
            text: 'The ending changes everything.',
            hasSpoilers: true,
            likesCount: 7,
            reviewer: 'Reader Two',
          },
        ],
      },
      audibleBaseUrl: 'https://www.audible.com',
      isLoading: false,
      error: null,
    });
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(<AudiobookDetailsModal asin="ASIN123" isOpen onClose={vi.fn()} />);
    await act(async () => {});

    expect(screen.getByText('336 pages')).toBeInTheDocument();
    expect(screen.getByText('9780000000001')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hardcover/i })).toHaveAttribute(
      'href',
      'https://hardcover.app/books/detail-book',
    );
    expect(screen.getByLabelText('Audible rating 4.2 out of 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Hardcover rating 4.2 out of 5')).toBeInTheDocument();

    const reviewsToggle = screen.getByRole('button', { name: /Hardcover Reviews/i });
    expect(reviewsToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(reviewsToggle);
    expect(reviewsToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('An excellent space opera.')).toBeInTheDocument();
    expect(screen.queryByText('The ending changes everything.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /contains spoilers/i }));
    expect(screen.getByText('The ending changes everything.')).toBeInTheDocument();
  });

  it('creates requests and auto-closes after success', async () => {
    vi.useFakeTimers();
    createRequestMock.mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    const onRequestSuccess = vi.fn();
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={onClose}
        onRequestSuccess={onRequestSuccess}
      />
    );

    await act(async () => {});
    const requestButton = screen.getByRole('button', { name: 'Submit Request' });
    fireEvent.click(requestButton);

    const requestPromise = createRequestMock.mock.results[0]?.value;
    await act(async () => {
      await requestPromise;
    });

    expect(onRequestSuccess).toHaveBeenCalled();
    expect(screen.getByText(/Audiobook request created!/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('creates audiobook and EPUB requests when Both is selected', async () => {
    vi.useFakeTimers();
    useEbookStatusMock.mockReturnValue({
      ebookStatus: {
        ebookSourcesEnabled: true,
        hasActiveEbookRequest: false,
        existingEbookStatus: null,
        existingEbookRequestId: null,
        ebookAvailable: false,
        audiobookAvailable: false,
        hasActiveAudiobookRequest: false,
        existingAudiobookStatus: null,
      },
      revalidate: revalidateEbookStatusMock,
    });
    createRequestMock.mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={onClose}
      />
    );

    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Both formats' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
    });

    expect(createRequestMock).toHaveBeenNthCalledWith(1, audiobookDetails, { mediaType: 'audiobook' });
    expect(createRequestMock).toHaveBeenNthCalledWith(2, audiobookDetails, { mediaType: 'epub' });
    expect(screen.getByText(/Audiobook and EPUB request created!/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('copies the ASIN to the clipboard', async () => {
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await act(async () => {});
    const asinButton = screen.getByText('ASIN123');
    await act(async () => {
      fireEvent.click(asinButton.closest('button') as HTMLButtonElement);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ASIN123');
  });

  it('shows an error state when details fail to load', async () => {
    useAudiobookDetailsMock.mockReturnValue({
      audiobook: null,
      isLoading: false,
      error: 'boom',
    });
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await act(async () => {});
    expect(screen.getByText('Failed to load details')).toBeInTheDocument();
  });

  it('shows availability state and hides interactive search when available', async () => {
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={vi.fn()}
        isAvailable={true}
      />
    );

    await act(async () => {});
    // Status badge and button both show "In Your Library"
    expect(screen.getAllByText('In Your Library').length).toBeGreaterThan(0);
    expect(screen.queryByTitle('Interactive Search')).toBeNull();
  });

  it('offers audiobook request when only the ebook is available', async () => {
    useEbookStatusMock.mockReturnValue({
      ebookStatus: {
        ebookSourcesEnabled: true,
        hasActiveEbookRequest: false,
        existingEbookStatus: 'available',
        existingEbookRequestId: 'ebook-1',
        ebookAvailable: true,
        audiobookAvailable: false,
        hasActiveAudiobookRequest: false,
        existingAudiobookStatus: null,
      },
      revalidate: revalidateEbookStatusMock,
    });
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={vi.fn()}
        isAvailable={true}
      />
    );

    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Audiobook' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Audiobook' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'eBook (EPUB)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Both formats' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit Request' })).toBeEnabled();
  });

  it('offers EPUB request when only the audiobook is available', async () => {
    useEbookStatusMock.mockReturnValue({
      ebookStatus: {
        ebookSourcesEnabled: true,
        hasActiveEbookRequest: false,
        existingEbookStatus: null,
        existingEbookRequestId: null,
        ebookAvailable: false,
        audiobookAvailable: true,
        hasActiveAudiobookRequest: true,
        existingAudiobookStatus: 'available',
      },
      revalidate: revalidateEbookStatusMock,
    });
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={vi.fn()}
        isAvailable={true}
      />
    );

    await act(async () => {});
    expect(screen.getByRole('button', { name: 'eBook (EPUB)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'eBook (EPUB)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Audiobook' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Both formats' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit Request' })).toBeEnabled();
  });

  it('hides request options when audiobook and ebook are both available', async () => {
    useEbookStatusMock.mockReturnValue({
      ebookStatus: {
        ebookSourcesEnabled: true,
        hasActiveEbookRequest: true,
        existingEbookStatus: 'available',
        existingEbookRequestId: 'ebook-1',
        ebookAvailable: true,
        audiobookAvailable: true,
        hasActiveAudiobookRequest: true,
        existingAudiobookStatus: 'available',
      },
      revalidate: revalidateEbookStatusMock,
    });
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={vi.fn()}
        isAvailable={true}
      />
    );

    await act(async () => {});
    expect(screen.getByRole('button', { name: 'In Your Library' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Request Audiobook' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Request EPUB' })).toBeNull();
  });

  it('shows pending approval status with requester name', async () => {
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={vi.fn()}
        isRequested={true}
        requestStatus="awaiting_approval"
        requestedByUsername="alice"
      />
    );

    await act(async () => {});
    expect(screen.getByRole('button', { name: /Pending Approval \(alice\)/ })).toBeDisabled();
  });

  it('shows request button for denied status (allows re-request)', async () => {
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={vi.fn()}
        isRequested={true}
        requestStatus="denied"
      />
    );

    await act(async () => {});
    // Denied status allows re-requesting.
    expect(screen.getByRole('button', { name: 'Submit Request' })).toBeInTheDocument();
  });

  it('does not show rating badge when rating is zero', async () => {
    useAudiobookDetailsMock.mockReturnValue({
      audiobook: { ...audiobookDetails, rating: 0 },
      isLoading: false,
      error: null,
    });
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await act(async () => {});
    // Rating badge is not shown when rating is 0
    expect(screen.queryByText('0.0')).toBeNull();
  });

  it('opens interactive search when requested', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'admin-1', username: 'admin', role: 'admin' } });
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await act(async () => {});

    expect(screen.queryByTestId('interactive-modal')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Interactive Search' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Interactive Search' }));

    expect(screen.getByTestId('interactive-modal')).toHaveAttribute('data-open', 'true');
  });

  it('shows request error and clears it after timeout', async () => {
    vi.useFakeTimers();
    createRequestMock.mockRejectedValueOnce(new Error('Request failed'));
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    const requestPromise = createRequestMock.mock.results[0]?.value;
    await act(async () => {
      try {
        await requestPromise;
      } catch {
        // Expected for this test.
      }
    });

    expect(screen.getByText('Request failed')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Request failed')).toBeNull();
  });

  it('reveals admin tools from the sticky footer when opened from a pending request', async () => {
    useAuthMock.mockReturnValue({ user: { id: 'admin-1', username: 'admin', role: 'admin' } });
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(
      <AudiobookDetailsModal
        asin="ASIN123"
        isOpen={true}
        onClose={vi.fn()}
        requestStatus="pending"
        isAvailable={false}
      />
    );

    await act(async () => {});

    const statusPill = screen.getByRole('button', { name: 'Requested' });
    expect(statusPill).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Interactive Search' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Manual Import' })).toBeNull();

    const adminButton = screen.getByRole('button', { name: 'Admin' });
    expect(adminButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(adminButton);

    expect(adminButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Interactive Search' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manual Import' })).toBeInTheDocument();
  });

  it('does not show a Read more toggle for a short summary', async () => {
    const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

    render(<AudiobookDetailsModal asin="ASIN123" isOpen={true} onClose={vi.fn()} />);

    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Read more' })).not.toBeInTheDocument();
  });

  it('expands and collapses a long summary via Read more/Show less', async () => {
    // jsdom doesn't do real layout, so scrollHeight/clientHeight are 0 by
    // default. Stub them to simulate a clamped paragraph that overflows.
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight');
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
    Object.defineProperty(Element.prototype, 'scrollHeight', { configurable: true, value: 200 });
    Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, value: 80 });

    try {
      useAudiobookDetailsMock.mockReturnValue({
        audiobook: { ...audiobookDetails, description: 'A'.repeat(400) },
        isLoading: false,
        error: null,
      });
      const { AudiobookDetailsModal } = await import('@/components/audiobooks/AudiobookDetailsModal');

      render(<AudiobookDetailsModal asin="ASIN123" isOpen={true} onClose={vi.fn()} />);

      await act(async () => {});
      const readMore = screen.getByRole('button', { name: 'Read more' });
      fireEvent.click(readMore);

      expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
    } finally {
      if (scrollHeightDescriptor) Object.defineProperty(Element.prototype, 'scrollHeight', scrollHeightDescriptor);
      if (clientHeightDescriptor) Object.defineProperty(Element.prototype, 'clientHeight', clientHeightDescriptor);
    }
  });
});
