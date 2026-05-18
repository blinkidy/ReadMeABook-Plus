/**
 * Component: Admin Jobs Page Tests
 * Documentation: documentation/backend/services/scheduler.md
 */

// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminJobsPage from '@/app/admin/jobs/page';

const authenticatedFetcherMock = vi.hoisted(() => vi.fn());
const fetchJSONMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('@/lib/utils/api', () => ({
  authenticatedFetcher: authenticatedFetcherMock,
  fetchJSON: fetchJSONMock,
}));

vi.mock('@/components/ui/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => toastMock,
}));

describe('AdminJobsPage', () => {
  beforeEach(() => {
    authenticatedFetcherMock.mockReset();
    fetchJSONMock.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it('renders scheduled jobs and allows manual trigger', async () => {
    authenticatedFetcherMock.mockResolvedValue({
      jobs: [
        {
          id: 'job-1',
          name: 'Library Scan',
          type: 'plex_library_scan',
          schedule: '0 * * * *',
          enabled: true,
          lastRun: null,
          nextRun: null,
        },
      ],
    });
    fetchJSONMock.mockResolvedValue({ success: true });

    render(<AdminJobsPage />);

    expect((await screen.findAllByText('Library Scan'))[0]).toBeInTheDocument();
    expect(
      (await screen.findAllByText('Scans your full media library to detect newly added audiobooks.'))[0]
    ).toBeInTheDocument();
    expect(screen.queryByText('plex_library_scan')).not.toBeInTheDocument();
    expect(screen.queryByText('About Scheduled Jobs')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Trigger Now/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Trigger Job' }));

    await waitFor(() => {
      expect(fetchJSONMock).toHaveBeenCalledWith('/api/admin/jobs/job-1/trigger', {
        method: 'POST',
      });
      expect(toastMock.success).toHaveBeenCalledWith('Job "Library Scan" triggered successfully');
    });

    expect(authenticatedFetcherMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('updates a job schedule using preset selection', async () => {
    authenticatedFetcherMock.mockResolvedValue({
      jobs: [
        {
          id: 'job-2',
          name: 'Audible Refresh',
          type: 'audible_refresh',
          schedule: '0 * * * *',
          enabled: true,
          lastRun: null,
          nextRun: null,
        },
      ],
    });
    fetchJSONMock.mockResolvedValue({ success: true });

    render(<AdminJobsPage />);

    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    fireEvent.click(screen.getByRole('radio', { name: /Every 2 hours/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(fetchJSONMock).toHaveBeenCalledWith('/api/admin/jobs/job-2', {
        method: 'PUT',
        body: JSON.stringify({ schedule: '0 */2 * * *', enabled: true }),
      });
      expect(toastMock.success).toHaveBeenCalledWith('Job "Audible Refresh" updated successfully');
    });
  });

  it('shows an error when jobs fail to load', async () => {
    authenticatedFetcherMock.mockRejectedValue(new Error('boom'));

    render(<AdminJobsPage />);

    expect(await screen.findByText('Failed to load scheduled jobs')).toBeInTheDocument();
  });
});
