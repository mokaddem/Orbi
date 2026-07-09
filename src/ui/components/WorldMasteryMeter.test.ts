import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import WorldMasteryMeter from './WorldMasteryMeter.svelte';
import { setLocale } from '../../i18n';
import type { MasteryResult } from '../../domain';

beforeEach(() => setLocale('en'));
afterEach(() => setLocale('en'));

const mastery: MasteryResult = {
  overall: { mastered: 39, learning: 20, unseen: 136, total: 195 },
  byRegion: [],
};

describe('WorldMasteryMeter', () => {
  it('shows the learned count and percentage', () => {
    render(WorldMasteryMeter, { mastery });
    expect(screen.getByText('39 of 195 countries learned')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('exposes an accessible progressbar with the mastered count', () => {
    render(WorldMasteryMeter, { mastery });
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '39');
    expect(bar).toHaveAttribute('aria-valuemax', '195');
  });

  it('applies the compact modifier when asked', () => {
    render(WorldMasteryMeter, { mastery, compact: true });
    expect(screen.getByTestId('mastery-meter')).toHaveClass('compact');
  });
});
