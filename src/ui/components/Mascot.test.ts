import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Mascot, { type MascotPose } from './Mascot.svelte';

const POSES: MascotPose[] = ['wave', 'celebrate', 'relaxed', 'sleepy', 'thinking', 'daily'];

describe('Mascot', () => {
  it.each(POSES)('renders the globe body for pose "%s"', (pose) => {
    const { container } = render(Mascot, { pose });
    const svg = container.querySelector('svg.mascot');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 120 120');
    // The shared globe base is always drawn (the sphere circle at r=32).
    expect(svg?.querySelector('circle[r="32"]')).toBeInTheDocument();
  });

  it('is decorative (aria-hidden) by default', () => {
    const { container } = render(Mascot, { pose: 'wave' });
    const svg = container.querySelector('svg.mascot');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
  });

  it('becomes a labelled image when given a label', () => {
    render(Mascot, { pose: 'celebrate', label: 'Perfect score' });
    expect(screen.getByRole('img', { name: 'Perfect score' })).toBeInTheDocument();
  });

  it('gives each instance a unique clipPath id', () => {
    const { container } = render(Mascot, { pose: 'wave' });
    render(Mascot, { pose: 'sleepy' });
    const ids = [...document.querySelectorAll('svg.mascot clipPath')].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(container.querySelector('clipPath')?.id).toMatch(/^globe-clip-\d+$/);
  });

  it('renders the calendar in the daily pose', () => {
    const { container } = render(Mascot, { pose: 'daily' });
    // The held calendar is the only <rect> in the artwork.
    expect(container.querySelector('svg.mascot rect')).toBeInTheDocument();
  });
});
