import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ChallengeSearchList from './ChallengeSearchList.svelte';
import { setLocale } from '../../i18n';

const OPTIONS = [
  { id: 'FR', label: 'France' },
  { id: 'DE', label: 'Germany' },
  { id: 'ES', label: 'Spain' },
  { id: 'ST', label: 'São Tomé and Príncipe' },
];

describe('ChallengeSearchList', () => {
  beforeEach(() => setLocale('en'));

  it('shows the whole pool up front (no 4-choice crutch) and filters as you type', async () => {
    render(ChallengeSearchList, {
      options: OPTIONS,
      placeholder: 'Type a country…',
      onpick: vi.fn(),
    });
    // Every option is reachable before typing — the pool is the whole continent.
    for (const o of OPTIONS) expect(screen.getByText(o.label)).toBeInTheDocument();

    const input = screen.getByLabelText('Type a country…');
    await fireEvent.input(input, { target: { value: 'ger' } });
    expect(screen.getByText('Germany')).toBeInTheDocument();
    expect(screen.queryByText('France')).not.toBeInTheDocument();
  });

  it('matches accent-insensitively ("sao" → "São Tomé…")', async () => {
    render(ChallengeSearchList, { options: OPTIONS, placeholder: 'x', onpick: vi.fn() });
    await fireEvent.input(screen.getByLabelText('x'), { target: { value: 'sao tome' } });
    expect(screen.getByText('São Tomé and Príncipe')).toBeInTheDocument();
    expect(screen.queryByText('Spain')).not.toBeInTheDocument();
  });

  it('shows a no-match message when nothing matches', async () => {
    render(ChallengeSearchList, { options: OPTIONS, placeholder: 'x', onpick: vi.fn() });
    await fireEvent.input(screen.getByLabelText('x'), { target: { value: 'zzz' } });
    expect(screen.getByText('No match')).toBeInTheDocument();
  });

  it('picks the chosen option id on click', async () => {
    const onpick = vi.fn();
    render(ChallengeSearchList, { options: OPTIONS, placeholder: 'x', onpick });
    await fireEvent.click(screen.getByText('Spain'));
    expect(onpick).toHaveBeenCalledWith('ES');
  });

  it('Enter commits the top match', async () => {
    const onpick = vi.fn();
    render(ChallengeSearchList, { options: OPTIONS, placeholder: 'x', onpick });
    const input = screen.getByLabelText('x');
    await fireEvent.input(input, { target: { value: 'fra' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onpick).toHaveBeenCalledWith('FR');
  });

  it('collapses to the reveal once answered — correct + the wrong pick, input gone', () => {
    render(ChallengeSearchList, {
      options: OPTIONS,
      placeholder: 'x',
      answered: true,
      correctId: 'FR',
      pickedId: 'DE',
      onpick: vi.fn(),
    });
    expect(screen.queryByLabelText('x')).not.toBeInTheDocument(); // input hidden
    expect(screen.getByText('France').closest('button')).toHaveClass('correct');
    expect(screen.getByText('Germany').closest('button')).toHaveClass('wrong');
    expect(screen.queryByText('Spain')).not.toBeInTheDocument(); // other options dropped
  });

  it('shows only the correct row on a passed (no wrong pick) reveal', () => {
    render(ChallengeSearchList, {
      options: OPTIONS,
      placeholder: 'x',
      answered: true,
      correctId: 'FR',
      pickedId: 'FR',
      onpick: vi.fn(),
    });
    expect(screen.getByText('France').closest('button')).toHaveClass('correct');
    expect(screen.queryByText('Germany')).not.toBeInTheDocument();
  });
});
