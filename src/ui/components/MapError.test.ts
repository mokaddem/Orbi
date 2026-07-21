import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import MapError from './MapError.svelte';
import { setLocale } from '../../i18n';

beforeEach(() => {
  setLocale('en');
});

describe('MapError', () => {
  it('shows the error message and the raw code, and retries on tap', async () => {
    const onRetry = vi.fn();
    render(MapError, { code: 'MAP-FETCH-503', onRetry });

    expect(screen.getByText('Could not load the map.')).toBeInTheDocument();
    // The code is surfaced verbatim so a reporting player can copy it.
    expect(screen.getByText('MAP-FETCH-503')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry button when no handler is provided', () => {
    render(MapError, { code: 'MAP-CHUNK' });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('MAP-CHUNK')).toBeInTheDocument();
  });

  it('disables the button and shows the retrying label mid-retry', () => {
    render(MapError, { code: 'MAP-DECODE', retrying: true, onRetry: () => {} });
    const btn = screen.getByRole('button', { name: /Retrying/ });
    expect(btn).toBeDisabled();
  });
});
