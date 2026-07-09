import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ChoiceGrid from './ChoiceGrid.svelte';
import type { ChoiceOption } from './choice-grid';
import { getCountry } from '../../data';
import { setLocale } from '../../i18n';

const fr = getCountry('FR')!;
const de = getCountry('DE')!;
const it_ = getCountry('IT')!;
const es = getCountry('ES')!;

/** Build normalized country options (id = ISO2, label = English name, flag-capable). */
const countryOptions = (): ChoiceOption[] =>
  [fr, de, it_, es].map((c) => ({ id: c.iso2, label: c.name.en, country: c }));

function button(container: HTMLElement, id: string): HTMLButtonElement {
  return container.querySelector(`button[data-id="${id}"]`) as HTMLButtonElement;
}

describe('ChoiceGrid', () => {
  beforeEach(() => setLocale('en'));

  it('renders each option label in the "name" variant', () => {
    render(ChoiceGrid, { options: countryOptions(), variant: 'name', onpick: vi.fn() });
    for (const c of [fr, de, it_, es]) {
      expect(screen.getByText(c.name.en)).toBeInTheDocument();
    }
  });

  it('calls onpick with the chosen option id', async () => {
    const onpick = vi.fn();
    const { container } = render(ChoiceGrid, {
      options: countryOptions(),
      variant: 'name',
      onpick,
    });
    await fireEvent.click(button(container, 'DE'));
    expect(onpick).toHaveBeenCalledTimes(1);
    expect(onpick).toHaveBeenCalledWith('DE');
  });

  it('renders plain attribute labels with no flag (attribute modes, e.g. capitals)', () => {
    const options: ChoiceOption[] = [
      { id: 'FR', label: 'Paris' },
      { id: 'DE', label: 'Berlin' },
      { id: 'IT', label: 'Rome' },
    ];
    const { container } = render(ChoiceGrid, { options, variant: 'name', onpick: vi.fn() });
    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('Berlin')).toBeInTheDocument();
    expect(container.querySelectorAll('img.flag').length).toBe(0);
  });

  it('locks and reveals once answered: correct is marked correct, picked-wrong is marked wrong', () => {
    const onpick = vi.fn();
    const { container } = render(ChoiceGrid, {
      options: countryOptions(),
      variant: 'name',
      answered: true,
      correctId: 'FR',
      pickedId: 'DE',
      onpick,
    });
    expect(button(container, 'FR')).toHaveAttribute('data-state', 'correct');
    expect(button(container, 'DE')).toHaveAttribute('data-state', 'wrong');
    expect(button(container, 'IT')).toHaveAttribute('data-state', 'muted');
    for (const c of [fr, de, it_, es]) {
      expect(button(container, c.iso2)).toBeDisabled();
    }
  });

  it('does not fire onpick once answered (buttons are disabled)', async () => {
    const onpick = vi.fn();
    const { container } = render(ChoiceGrid, {
      options: countryOptions(),
      variant: 'name',
      answered: true,
      correctId: 'FR',
      pickedId: 'DE',
      onpick,
    });
    await fireEvent.click(button(container, 'FR'));
    expect(onpick).not.toHaveBeenCalled();
  });

  it('shows a flag thumbnail alongside every name in the "name-flag" variant (map-highlight)', () => {
    const { container } = render(ChoiceGrid, {
      options: countryOptions(),
      variant: 'name-flag',
      onpick: vi.fn(),
    });
    // Names are always visible…
    for (const c of [fr, de, it_, es]) {
      expect(screen.getByText(c.name.en)).toBeInTheDocument();
    }
    // …and each option carries a flag thumbnail from the start (an extra cue, not the answer).
    expect(container.querySelectorAll('img.flag').length).toBe(4);
  });

  it('shows flags (not names) in the "flag" variant until answered, then reveals names', () => {
    const { container, rerender } = render(ChoiceGrid, {
      options: countryOptions(),
      variant: 'flag',
      onpick: vi.fn(),
    });
    // Flags render as <img>; names are hidden while unanswered.
    expect(container.querySelectorAll('img.flag').length).toBe(4);
    expect(screen.queryByText(fr.name.en)).not.toBeInTheDocument();

    rerender({
      options: countryOptions(),
      variant: 'flag',
      answered: true,
      correctId: 'FR',
      pickedId: 'DE',
      onpick: vi.fn(),
    });
    expect(screen.getByText(fr.name.en)).toBeInTheDocument();
  });
});
