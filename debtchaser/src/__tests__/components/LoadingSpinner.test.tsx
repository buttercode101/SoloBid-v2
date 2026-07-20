import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render with default message', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Initializing System')).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    render(<LoadingSpinner message="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    const { container } = render(<LoadingSpinner />);
    const statusElement = container.querySelector('[role="status"]');
    expect(statusElement).toBeInTheDocument();
    expect(statusElement?.getAttribute('aria-live')).toBe('polite');
  });
});
