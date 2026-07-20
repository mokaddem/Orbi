import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import DuelQrModal from './DuelQrModal.svelte';
import { setLocale } from '../../i18n';

const baseProps = () => ({
  open: true,
  url: 'https://mokaddem.github.io/Orbi/#/duel?c=eyJ2IjoiMi41In0',
  eyebrow: 'Sami challenges you!',
  context: 'Flags · Europe · Beat 18/20',
  onClose: vi.fn(),
});

beforeEach(() => setLocale('en'));

describe('DuelQrModal', () => {
  it('renders a scannable QR + camera hint when open', () => {
    const { container } = render(DuelQrModal, { props: baseProps() });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Point your camera to play')).toBeInTheDocument();
    // The eyebrow is drawn uppercase.
    expect(screen.getByText('SAMI CHALLENGES YOU!')).toBeInTheDocument();
    // The QR is a single non-trivial crisp-edges path.
    const qr = container.querySelector('path[shape-rendering="crispEdges"]');
    expect(qr).toBeInTheDocument();
    expect((qr?.getAttribute('d') ?? '').length).toBeGreaterThan(200);
  });

  it('renders nothing when closed', () => {
    render(DuelQrModal, { props: { ...baseProps(), open: false } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dismisses via the × button, the backdrop, and Escape', async () => {
    const onClose = vi.fn();
    const { container } = render(DuelQrModal, { props: { ...baseProps(), onClose } });

    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await fireEvent.click(container.querySelector('.backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(2);

    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
