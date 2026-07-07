import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SegmentedControl from './SegmentedControl.svelte';

const few = [
  { value: '', label: 'All' },
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

// 10 options — above the default threshold of 8.
const many = Array.from({ length: 10 }, (_, i) => ({ value: `v${i}`, label: `Opt ${i}` }));

describe('SegmentedControl', () => {
  it('renders a button group when options are within the threshold', () => {
    render(SegmentedControl, { options: few, value: 'a', onchange: () => {}, ariaLabel: 'Pick' });
    const group = screen.getByRole('group', { name: 'Pick' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-pressed', 'false');
    // Not a dropdown.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('falls back to a dropdown when options exceed the threshold', () => {
    render(SegmentedControl, { options: many, value: 'v0', onchange: () => {}, ariaLabel: 'Pick' });
    expect(screen.getByRole('combobox', { name: 'Pick' })).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('honors a custom threshold', () => {
    render(SegmentedControl, { options: few, value: '', onchange: () => {}, threshold: 2 });
    // 3 options > threshold 2 → dropdown.
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('emits the picked value from a button click', async () => {
    const onchange = vi.fn();
    render(SegmentedControl, { options: few, value: 'a', onchange });
    await fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onchange).toHaveBeenCalledWith('b');
  });

  it('emits the picked value from a dropdown change', async () => {
    const onchange = vi.fn();
    render(SegmentedControl, { options: many, value: 'v0', onchange });
    await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'v3' } });
    expect(onchange).toHaveBeenCalledWith('v3');
  });
});
