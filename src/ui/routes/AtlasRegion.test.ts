import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AtlasRegion from './AtlasRegion.svelte';

describe('AtlasRegion', () => {
  it('shows the region, its sub-regions, and member links', () => {
    const { container, getByRole } = render(AtlasRegion, { params: { region: 'Europe' } });

    expect(getByRole('heading', { level: 1, name: 'Europe' })).toBeInTheDocument();
    // A regrouped sub-region heading (Phase 19 buckets).
    expect(getByRole('heading', { level: 2, name: /Western Europe/ })).toBeInTheDocument();
    // A member country links to its country page.
    const france = container.querySelector('a[href="#/atlas/country/FR"]');
    expect(france).toBeInTheDocument();
    expect(france?.textContent).toContain('France');
  });

  it('decodes the region param', () => {
    const { getByRole } = render(AtlasRegion, {
      params: { region: encodeURIComponent('Americas') },
    });
    expect(getByRole('heading', { level: 1, name: 'Americas' })).toBeInTheDocument();
  });

  it('renders a graceful not-found for an unknown region', () => {
    const { getByText, getByRole } = render(AtlasRegion, { params: { region: 'Atlantis' } });
    expect(getByText(/couldn.t find that region/i)).toBeInTheDocument();
    expect(getByRole('link', { name: /Back to the Atlas/i })).toHaveAttribute('href', '#/atlas');
  });
});
