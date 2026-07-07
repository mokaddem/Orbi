import { describe, it, expect } from 'vitest';
import { formatDuration, formatPercent } from './format';

describe('formatDuration', () => {
  it('shows one decimal second under a minute', () => {
    expect(formatDuration(0)).toBe('0.0s');
    expect(formatDuration(12_340)).toBe('12.3s');
    expect(formatDuration(59_900)).toBe('59.9s');
  });

  it('shows m:ss from a minute up', () => {
    expect(formatDuration(60_000)).toBe('1:00');
    expect(formatDuration(90_000)).toBe('1:30');
    expect(formatDuration(605_000)).toBe('10:05');
  });

  it('carries a 59.5s+ remainder into the next minute rather than showing :60', () => {
    expect(formatDuration(119_800)).toBe('2:00');
  });

  it('never returns a negative duration', () => {
    expect(formatDuration(-500)).toBe('0.0s');
  });
});

describe('formatPercent', () => {
  it('renders a fraction as a whole-number percentage', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.8)).toBe('80%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(2 / 3)).toBe('67%');
  });
});
