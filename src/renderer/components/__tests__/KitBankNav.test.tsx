// Test suite for KitBankNav component
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import KitBankNav from '../KitBankNav';

afterEach(() => {
  cleanup();
});

describe('KitBankNav', () => {
  it('renders all 26 bank buttons', () => {
    render(<KitBankNav kits={[]} onBankClick={() => {}} />);
    for (let i = 0; i < 26; i++) {
      const bank = String.fromCharCode(65 + i);
      // Use queryAllByText to avoid Chai matcher and ambiguity
      const buttons = screen.queryAllByText(bank);
      expect(buttons.length).toBeGreaterThan(0);
    }
  });

  it('disables banks with no kits', () => {
    render(<KitBankNav kits={['A1', 'B2']} onBankClick={() => {}} />);
    // Find all A buttons and check which is enabled/disabled
    const aButtons = screen.queryAllByText('A');
    const bButtons = screen.queryAllByText('B');
    const cButtons = screen.queryAllByText('C');
    const zButtons = screen.queryAllByText('Z');
    // At least one enabled for A and B, all disabled for C and Z
    expect(aButtons.some(btn => !btn.disabled)).toBe(true);
    expect(bButtons.some(btn => !btn.disabled)).toBe(true);
    expect(cButtons.every(btn => btn.disabled)).toBe(true);
    expect(zButtons.every(btn => btn.disabled)).toBe(true);
  });

  it('calls onBankClick when enabled bank is clicked', () => {
    const onBankClick = vi.fn();
    render(<KitBankNav kits={['A1', 'B2']} onBankClick={onBankClick} />);
    const aButtons = screen.getAllByRole('button', { name: 'Jump to bank A' });
    const enabledA = aButtons.find(btn => !btn.disabled);

    expect(enabledA).toBeDefined();
    expect(enabledA?.disabled).toBe(false); // Debug: ensure it's enabled
    fireEvent.click(enabledA!);
    expect(onBankClick).toHaveBeenCalledWith('A');
  });

  it('does not call onBankClick when disabled bank is clicked', () => {
    const onBankClick = vi.fn();
    render(<KitBankNav kits={['A1']} onBankClick={onBankClick} />);
    // Use getAllByRole to match the correct button by accessible name
    const bButtons = screen.getAllByRole('button', { name: 'Jump to bank B' });
    const disabledB = bButtons.find(btn => btn.disabled);
    expect(disabledB).toBeDefined();
    fireEvent.click(disabledB!);
    expect(onBankClick).not.toHaveBeenCalled();
  });

  it('shows bankNames as title if provided', () => {
    render(<KitBankNav kits={['A1']} onBankClick={() => {}} bankNames={{ A: 'Alpha' }} />);
    expect(screen.getByTitle('Alpha')).not.toBeNull();
  });
});
