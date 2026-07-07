import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Flag from './Flag.svelte';
import { getCountry } from '../../data';

const bulgaria = getCountry('BG')!;
const france = getCountry('FR')!;

describe('Flag', () => {
  it('resolves the country’s bundled SVG to a usable src, distinct per country', () => {
    const bg = render(Flag, { country: bulgaria });
    const bgImg = bg.container.querySelector('img.flag') as HTMLImageElement;
    expect(bgImg).toBeInTheDocument();
    expect(bgImg.getAttribute('src')).toBeTruthy();

    // A different country resolves to a different asset (not a shared placeholder).
    const fr = render(Flag, { country: france });
    const frImg = fr.container.querySelector('img.flag') as HTMLImageElement;
    expect(frImg.getAttribute('src')).not.toBe(bgImg.getAttribute('src'));
  });

  it('is decorative by default (empty alt) so the prompt flag can’t be read as the answer', () => {
    const { container } = render(Flag, { country: bulgaria });
    const img = container.querySelector('img.flag') as HTMLImageElement;
    expect(img).toHaveAttribute('alt', '');
  });

  it('uses an explicit alt when the caller names the country', () => {
    render(Flag, { country: bulgaria, alt: 'Bulgaria' });
    expect(screen.getByRole('img', { name: 'Bulgaria' })).toBeInTheDocument();
  });
});
