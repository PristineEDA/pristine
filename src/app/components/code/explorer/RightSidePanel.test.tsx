import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RightSidePanel } from './RightSidePanel';

const PANEL_ITEM_TIMEOUT_MS = 5000;

type TestUser = ReturnType<typeof userEvent.setup>;

async function clickButton(user: TestUser, name: RegExp) {
  await user.click(screen.getByRole('radio', { name }));
}

describe('RightSidePanel', () => {
  it('shows an assistant skeleton while the AI panel chunk is still loading', () => {
    render(
      <RightSidePanel currentOutlineId="rtl/core/alu.v" onFileOpen={vi.fn()} onLineJump={vi.fn()} />,
    );

    expect(screen.getByTestId('right-panel-tabs')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /ai assistant/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /static check/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /references/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /outline/i })).toBeInTheDocument();
    expect(screen.queryByText('AI Assistant')).not.toBeInTheDocument();
    expect(screen.getByTestId('assistant-panel-suspense-skeleton')).toBeInTheDocument();
    expect(screen.queryByText(/Loading assistant/i)).not.toBeInTheDocument();
  });

  it('navigates static check items to their source file and line', async () => {
    const user = userEvent.setup();
    const onFileOpen = vi.fn();
    const onLineJump = vi.fn();

    render(
      <RightSidePanel currentOutlineId="rtl/core/cpu_top.v" onFileOpen={onFileOpen} onLineJump={onLineJump} />,
    );

    await clickButton(user, /static check/i);
    expect(await screen.findByText(/Static Check Report/i, undefined, { timeout: PANEL_ITEM_TIMEOUT_MS })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /cpu_top\.v:65/i }, { timeout: PANEL_ITEM_TIMEOUT_MS }));

    expect(onFileOpen).toHaveBeenCalledWith('cpu_top', 'cpu_top.v');
    expect(onLineJump).toHaveBeenCalledWith(65);
  });

  it('opens a reference target when a reference row is clicked', async () => {
    const user = userEvent.setup();
    const onFileOpen = vi.fn();
    const onLineJump = vi.fn();

    render(
      <RightSidePanel currentOutlineId="rtl/core/uart_tx.v" onFileOpen={onFileOpen} onLineJump={onLineJump} />,
    );

    await clickButton(user, /references/i);
    expect(await screen.findByText(/4 references · uart_tx\.v/i, undefined, { timeout: PANEL_ITEM_TIMEOUT_MS })).toBeInTheDocument();

    await user.click(await screen.findByText('L40', undefined, { timeout: PANEL_ITEM_TIMEOUT_MS }));

    expect(onFileOpen).toHaveBeenCalledWith('uart_tx', 'uart_tx.v');
    expect(onLineJump).toHaveBeenCalledWith(40);
  });

  it('renders the current file outline and jumps to the selected symbol line', async () => {
    const user = userEvent.setup();
    const onLineJump = vi.fn();

    render(
      <RightSidePanel currentOutlineId="rtl/core/alu.v" onFileOpen={vi.fn()} onLineJump={onLineJump} />,
    );

    await clickButton(user, /outline/i);
    expect(await screen.findByText(/OUTLINE - alu\.v/i, undefined, { timeout: PANEL_ITEM_TIMEOUT_MS })).toBeInTheDocument();

    await user.click(await screen.findByText('always @(*) [ALU logic]', undefined, { timeout: PANEL_ITEM_TIMEOUT_MS }));

    expect(onLineJump).toHaveBeenCalledWith(42);
  });
});
