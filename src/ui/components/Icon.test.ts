import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Icon from './Icon.svelte';
import { icons } from './icons';

describe('Icon', () => {
  it('renders the registry glyph inside a 24x24 currentColor svg', () => {
    const { container } = render(Icon, { name: 'home' });
    const svg = container.querySelector('svg.icon');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    // The Lucide "home" glyph is a couple of paths — copied verbatim into the registry.
    expect(svg?.innerHTML).toContain('path');
    expect(svg?.innerHTML).toContain(icons.home.slice(0, 12));
  });

  it('is decorative (aria-hidden) by default', () => {
    const { container } = render(Icon, { name: 'flame' });
    const svg = container.querySelector('svg.icon');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
  });

  it('becomes a labelled image when given a label', () => {
    render(Icon, { name: 'flame', label: 'Streak' });
    const svg = screen.getByRole('img', { name: 'Streak' });
    expect(svg).toBeInTheDocument();
    expect(svg).not.toHaveAttribute('aria-hidden');
  });

  it('accepts a numeric size (px) and a CSS length', () => {
    const px = render(Icon, { name: 'home', size: 20 });
    expect(px.container.querySelector('svg')).toHaveStyle({ width: '20px' });
    const em = render(Icon, { name: 'home', size: '1.5em' });
    expect(em.container.querySelector('svg')).toHaveStyle({ width: '1.5em' });
  });
});
