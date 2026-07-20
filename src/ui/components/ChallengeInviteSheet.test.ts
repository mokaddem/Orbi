import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ChallengeInviteSheet from './ChallengeInviteSheet.svelte';
import { setLocale } from '../../i18n';

beforeEach(() => setLocale('en'));

describe('ChallengeInviteSheet (Phase 46b)', () => {
  it('renders the scope + the same share options as the duel card when open', () => {
    render(ChallengeInviteSheet, {
      open: true,
      family: 'flags',
      region: 'Africa',
      name: 'Sami',
      onClose: () => {},
    });
    // Scope + primary share (title and button both read "Challenge a friend").
    expect(screen.getByText('Flags · Africa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Challenge a friend/ })).toBeInTheDocument();
    // Fallback options (canvas is unavailable in jsdom, so the image-dependent "Copy image" is hidden).
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show QR' })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(ChallengeInviteSheet, {
      open: false,
      family: 'flags',
      region: 'Africa',
      name: 'Sami',
      onClose: () => {},
    });
    expect(container.querySelector('.sheet')).toBeNull();
  });

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn();
    render(ChallengeInviteSheet, {
      open: true,
      family: 'flags',
      region: 'Africa',
      name: 'Sami',
      onClose,
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
