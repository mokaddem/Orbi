import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import GrandmasterInviteCard from './GrandmasterInviteCard.svelte';
import { setLocale } from '../../i18n';

beforeEach(() => {
  setLocale('en');
});

describe('GrandmasterInviteCard', () => {
  it('renders the ceremonial invitation: the availability badge, title, body, and gold CTA', () => {
    render(GrandmasterInviteCard, { onenter: vi.fn() });
    const card = screen.getByTestId('grandmaster-invite');
    expect(card).toHaveTextContent('Grandmaster Challenge');
    expect(card).toHaveTextContent('Available today');
    expect(card).toHaveTextContent(/Prove a mastered family/);
    expect(screen.getByRole('button', { name: /Enter the gauntlet/ })).toBeInTheDocument();
  });

  it('fires onenter when the CTA is clicked (Home owns the routing)', async () => {
    const onenter = vi.fn();
    render(GrandmasterInviteCard, { onenter });
    await fireEvent.click(screen.getByRole('button', { name: /Enter the gauntlet/ }));
    expect(onenter).toHaveBeenCalledTimes(1);
  });
});
