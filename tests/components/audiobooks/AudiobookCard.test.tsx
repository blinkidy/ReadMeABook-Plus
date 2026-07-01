/**
 * Component: Audiobook Card Tests
 * Documentation: documentation/frontend/components.md
 */

// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createRequestMock = vi.hoisted(() => vi.fn());
const authState = {
  user: null as null | { id: string; username: string },
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/hooks/useRequests', () => ({
  useCreateRequest: () => ({ createRequest: createRequestMock, isLoading: false }),
}));

vi.mock('@/components/audiobooks/AudiobookDetailsModal', () => ({
  AudiobookDetailsModal: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="details-modal" data-open={String(isOpen)} />
  ),
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

const baseAudiobook = {
  asin: 'asin-1',
  title: 'Test Book',
  author: 'Author',
};

describe('AudiobookCard', () => {
  beforeEach(() => {
    authState.user = null;
    createRequestMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render card-level request controls', async () => {
    const { AudiobookCard } = await import('@/components/audiobooks/AudiobookCard');

    render(<AudiobookCard audiobook={baseAudiobook} />);

    expect(screen.queryByRole('button', { name: 'Sign in to Request' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request Audiobook' })).not.toBeInTheDocument();
    expect(createRequestMock).not.toHaveBeenCalled();
  });

  it('opens details for requesting instead of creating requests from the card', async () => {
    authState.user = { id: 'user-1', username: 'user' };
    const onRequestSuccess = vi.fn();
    const { AudiobookCard } = await import('@/components/audiobooks/AudiobookCard');

    render(<AudiobookCard audiobook={baseAudiobook} onRequestSuccess={onRequestSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: 'View details for Test Book by Author' }));

    expect(screen.getByTestId('details-modal')).toHaveAttribute('data-open', 'true');
    expect(createRequestMock).not.toHaveBeenCalled();
    expect(onRequestSuccess).not.toHaveBeenCalled();
  });

  it('shows in-library state when available', async () => {
    const { AudiobookCard } = await import('@/components/audiobooks/AudiobookCard');

    render(<AudiobookCard audiobook={{ ...baseAudiobook, isAvailable: true }} />);

    expect(screen.queryByText('In Your Library')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details for Test Book by Author' })).toBeInTheDocument();
  });

  it('opens the details modal when the title is clicked', async () => {
    const { AudiobookCard } = await import('@/components/audiobooks/AudiobookCard');

    render(<AudiobookCard audiobook={baseAudiobook} />);

    expect(screen.getByTestId('details-modal')).toHaveAttribute('data-open', 'false');

    fireEvent.click(screen.getByText('Test Book'));

    expect(screen.getByTestId('details-modal')).toHaveAttribute('data-open', 'true');
  });

  it('shows processing state for downloaded requests', async () => {
    const { AudiobookCard } = await import('@/components/audiobooks/AudiobookCard');

    render(
      <AudiobookCard
        audiobook={{ ...baseAudiobook, isRequested: true, requestStatus: 'downloaded' }}
      />
    );

    expect(screen.queryByText('Processing')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details for Test Book by Author' })).toBeInTheDocument();
  });

  it('shows pending status for awaiting_approval requests', async () => {
    const { AudiobookCard } = await import('@/components/audiobooks/AudiobookCard');

    render(
      <AudiobookCard
        audiobook={{
          ...baseAudiobook,
          isRequested: true,
          requestStatus: 'awaiting_approval',
          requestedByUsername: 'alice',
        }}
      />
    );

    expect(screen.queryByText('Requested')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details for Test Book by Author' })).toBeInTheDocument();
  });

  it('opens details for denied status instead of showing a card request button', async () => {
    authState.user = { id: 'user-1', username: 'user' };
    const { AudiobookCard } = await import('@/components/audiobooks/AudiobookCard');

    render(
      <AudiobookCard
        audiobook={{ ...baseAudiobook, isRequested: true, requestStatus: 'denied' }}
      />
    );

    expect(screen.queryByRole('button', { name: 'Request Audiobook' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View details for Test Book by Author' }));
    expect(screen.getByTestId('details-modal')).toHaveAttribute('data-open', 'true');
  });

  it('shows only the audiobook badge when only the audiobook is owned', async () => {
    const { AudiobookCard } = await import('@/components/audiobooks/AudiobookCard');

    render(<AudiobookCard audiobook={{ ...baseAudiobook, audiobookAvailable: true, ebookAvailable: false }} />);

    expect(screen.getByTitle('You own this as an audiobook')).toBeInTheDocument();
    expect(screen.queryByTitle('You own this as an ebook')).not.toBeInTheDocument();
  });

  it('shows only the ebook badge when only the ebook is owned', async () => {
    const { AudiobookCard } = await import('@/components/audiobooks/AudiobookCard');

    render(<AudiobookCard audiobook={{ ...baseAudiobook, audiobookAvailable: false, ebookAvailable: true }} />);

    expect(screen.queryByTitle('You own this as an audiobook')).not.toBeInTheDocument();
    expect(screen.getByTitle('You own this as an ebook')).toBeInTheDocument();
  });

  it('shows both badges when both formats are owned', async () => {
    const { AudiobookCard } = await import('@/components/audiobooks/AudiobookCard');

    render(<AudiobookCard audiobook={{ ...baseAudiobook, audiobookAvailable: true, ebookAvailable: true }} />);

    expect(screen.getByTitle('You own this as an audiobook')).toBeInTheDocument();
    expect(screen.getByTitle('You own this as an ebook')).toBeInTheDocument();
  });

  it('shows no format badges when neither format is owned', async () => {
    const { AudiobookCard } = await import('@/components/audiobooks/AudiobookCard');

    render(<AudiobookCard audiobook={{ ...baseAudiobook, audiobookAvailable: false, ebookAvailable: false }} />);

    expect(screen.queryByTitle('You own this as an audiobook')).not.toBeInTheDocument();
    expect(screen.queryByTitle('You own this as an ebook')).not.toBeInTheDocument();
  });
});
