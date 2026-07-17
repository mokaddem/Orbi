import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import GauntletOfferModal from './GauntletOfferModal.svelte';
import { setLocale } from '../../i18n';

beforeEach(() => {
  setLocale('en');
});

function open(over: Record<string, unknown> = {}) {
  const onaccept = vi.fn();
  const oncancel = vi.fn();
  const utils = render(GauntletOfferModal, {
    open: true,
    family: 'flags',
    region: 'Oceania',
    slots: 52,
    onaccept,
    oncancel,
    ...over,
  });
  return { onaccept, oncancel, ...utils };
}

describe('GauntletOfferModal', () => {
  it('renders nothing when closed', () => {
    render(GauntletOfferModal, {
      open: false,
      family: 'flags',
      region: 'Oceania',
      slots: 52,
      onaccept: vi.fn(),
      oncancel: vi.fn(),
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('states the real stakes: the dynamic slot count, one life, and the fatal warning', () => {
    open({ slots: 108 });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('The Grandmaster Challenge');
    // The run's real question count (not a hard-coded 100) drives the "Questions" stake.
    expect(dialog).toHaveTextContent('108');
    expect(dialog).toHaveTextContent('Questions');
    expect(dialog).toHaveTextContent('Life');
    expect(dialog).toHaveTextContent('One wrong answer ends the challenge.');
    // While available, the informational once-a-day line shows and Accept is offered.
    expect(dialog).toHaveTextContent('One attempt a day');
    // The specific run it offers is named (composed from the family + continent labels).
    expect(dialog).toHaveTextContent(/Flags/);
    expect(dialog).toHaveTextContent(/Oceania/);
  });

  it('accepts the challenge via the gold CTA', async () => {
    const { onaccept, oncancel } = open();
    await fireEvent.click(screen.getByRole('button', { name: 'Accept the challenge' }));
    expect(onaccept).toHaveBeenCalledTimes(1);
    expect(oncancel).not.toHaveBeenCalled();
  });

  it('backs out via "Not yet"', async () => {
    const { onaccept, oncancel } = open();
    await fireEvent.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(oncancel).toHaveBeenCalledTimes(1);
    expect(onaccept).not.toHaveBeenCalled();
  });

  it('dismisses (cancels) on Escape', async () => {
    const { oncancel } = open();
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(oncancel).toHaveBeenCalledTimes(1);
  });

  it('dismisses (cancels) on a backdrop click, but not on a click inside the dialog', async () => {
    const { oncancel } = open();
    // A click on the dialog itself must NOT dismiss.
    await fireEvent.click(screen.getByRole('dialog'));
    expect(oncancel).not.toHaveBeenCalled();
    // A click on the backdrop (the dialog's parent) dismisses.
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    await fireEvent.click(backdrop);
    expect(oncancel).toHaveBeenCalledTimes(1);
  });

  // Cooldown (Phase 45 ⑤): once today's attempt is spent the modal gates entry — no Accept, and the
  // informational line becomes the live countdown.
  it('on cooldown: hides Accept, shows the countdown, and offers only Close', () => {
    open({ spent: true, cooldown: 'Next attempt in 5h 30m' });
    const dialog = screen.getByRole('dialog');
    expect(screen.queryByRole('button', { name: 'Accept the challenge' })).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent('Next attempt in 5h 30m');
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    // The stakes still read (the player sees what they'll face tomorrow).
    expect(dialog).toHaveTextContent('One wrong answer ends the challenge.');
  });

  it('on cooldown: Close backs out (cancel), never accept', async () => {
    const { onaccept, oncancel } = open({ spent: true, cooldown: 'Next attempt in 2h' });
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(oncancel).toHaveBeenCalledTimes(1);
    expect(onaccept).not.toHaveBeenCalled();
  });
});
