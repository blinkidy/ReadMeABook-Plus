/**
 * Component: Status Badge Tests
 * Documentation: documentation/frontend/components.md
 */

// @vitest-environment jsdom

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '@/components/requests/StatusBadge';

describe('StatusBadge', () => {
  it('uses the initializing label for zero-progress downloads', () => {
    render(<StatusBadge status="downloading" progress={0} />);
    expect(screen.getByText('Initializing...')).toBeInTheDocument();
  });

  it('falls back to the raw status when unknown', () => {
    render(<StatusBadge status="custom_status" />);
    expect(screen.getByText('custom_status')).toBeInTheDocument();
  });

  it('renders the awaiting_release label with teal styling', () => {
    render(<StatusBadge status="awaiting_release" />);
    const badge = screen.getByText('Awaiting Release');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-teal-100');
    expect(badge.className).toContain('text-teal-800');
    expect(badge.className).toContain('dark:bg-teal-900');
    expect(badge.className).toContain('dark:text-teal-200');
  });
});
