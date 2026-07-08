import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ChoiceGrid from './ChoiceGrid.svelte';
import { getCountry } from '../../data';
import { setLocale } from '../../i18n';

const fr = getCountry('FR')!;
const de = getCountry('DE')!;
const it_ = getCountry('IT')!;
const es = getCountry('ES')!;
const options = [fr, de, it_, es];

function button(container: HTMLElement, iso2: string): HTMLButtonElement {
  return container.querySelector(`button[data-iso="${iso2}"]`) as HTMLButtonElement;
}

describe('ChoiceGrid', () => {
  beforeEach(() => setLocale('en'));

  it('renders each option as a localized name in the "name" variant', () => {
    render(ChoiceGrid, { options, variant: 'name', onpick: vi.fn() });
    for (const c of options) {
      expect(screen.getByText(c.name.en)).toBeInTheDocument();
    }
  });

  it('calls onpick with the chosen country', async () => {
    const onpick = vi.fn();
    const { container } = render(ChoiceGrid, { options, variant: 'name', onpick });
    await fireEvent.click(button(container, 'DE'));
    expect(onpick).toHaveBeenCalledTimes(1);
    expect(onpick).toHaveBeenCalledWith(de);
  });

  it('locks and reveals once answered: correct is marked correct, picked-wrong is marked wrong', () => {
    const onpick = vi.fn();
    const { container } = render(ChoiceGrid, {
      options,
      variant: 'name',
      answered: true,
      correctIso: 'FR',
      pickedIso: 'DE',
      onpick,
    });
    expect(button(container, 'FR')).toHaveAttribute('data-state', 'correct');
    expect(button(container, 'DE')).toHaveAttribute('data-state', 'wrong');
    expect(button(container, 'IT')).toHaveAttribute('data-state', 'muted');
    for (const c of options) {
      expect(button(container, c.iso2)).toBeDisabled();
    }
  });

  it('does not fire onpick once answered (buttons are disabled)', async () => {
    const onpick = vi.fn();
    const { container } = render(ChoiceGrid, {
      options,
      variant: 'name',
      answered: true,
      correctIso: 'FR',
      pickedIso: 'DE',
      onpick,
    });
    await fireEvent.click(button(container, 'FR'));
    expect(onpick).not.toHaveBeenCalled();
  });

  it('shows a flag thumbnail alongside every name in the "name-flag" variant (map-highlight)', () => {
    const { container } = render(ChoiceGrid, { options, variant: 'name-flag', onpick: vi.fn() });
    // Names are always visible…
    for (const c of options) {
      expect(screen.getByText(c.name.en)).toBeInTheDocument();
    }
    // …and each option carries a flag thumbnail from the start (an extra cue, not the answer).
    expect(container.querySelectorAll('img.flag').length).toBe(options.length);
  });

  it('shows flags (not names) in the "flag" variant until answered, then reveals names', () => {
    const { container, rerender } = render(ChoiceGrid, {
      options,
      variant: 'flag',
      onpick: vi.fn(),
    });
    // Flags render as <img>; names are hidden while unanswered.
    expect(container.querySelectorAll('img.flag').length).toBe(options.length);
    expect(screen.queryByText(fr.name.en)).not.toBeInTheDocument();

    rerender({
      options,
      variant: 'flag',
      answered: true,
      correctIso: 'FR',
      pickedIso: 'DE',
      onpick: vi.fn(),
    });
    expect(screen.getByText(fr.name.en)).toBeInTheDocument();
  });
});
