import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CodeViewerLayoutProvider,
  WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY,
  type CodeViewerLayoutMode,
} from '../../../context/CodeViewerLayoutContext';
import { RightSidePanel } from './RightSidePanel';

const PANEL_ITEM_TIMEOUT_MS = 10000;
const PANEL_TEST_TIMEOUT_MS = 10000;

type TestUser = ReturnType<typeof userEvent.setup>;

function expectCompactTabButton(testId: string) {
  const tabButton = screen.getByTestId(testId);
  const icon = tabButton.querySelector('svg');

  expect(tabButton).toHaveClass('h-7', 'w-7');
  expect(icon).not.toBeNull();
  expect(icon!).toHaveAttribute('width', '12');
  expect(icon!).toHaveAttribute('height', '12');
}

async function clickButton(user: TestUser, name: RegExp) {
  await user.click(screen.getByRole('radio', { name }));
}

function mockCodeViewerLayoutMode(layoutMode: CodeViewerLayoutMode) {
  vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
    key === WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY ? layoutMode : null,
  );
}

function renderRightSidePanelInLayout(layoutMode: CodeViewerLayoutMode) {
  mockCodeViewerLayoutMode(layoutMode);

  render(
    <CodeViewerLayoutProvider>
      <RightSidePanel currentOutlineId="rtl/core/alu.v" onFileOpen={vi.fn()} onLineJump={vi.fn()} />
    </CodeViewerLayoutProvider>,
  );
}

describe('RightSidePanel', () => {
  it('shows an assistant skeleton while the AI panel chunk is still loading', () => {
    render(
      <RightSidePanel currentOutlineId="rtl/core/alu.v" onFileOpen={vi.fn()} onLineJump={vi.fn()} />,
    );

    expect(screen.getByTestId('right-panel-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel-header').className).not.toMatch(/\bbg-/);
    expect(screen.getByTestId('right-panel-header')).toHaveClass('border-b', 'border-border');
    expect(screen.getByRole('radio', { name: /ai assistant/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /static check/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /references/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /outline/i })).toBeInTheDocument();
    expectCompactTabButton('right-panel-tab-ai');
    expectCompactTabButton('right-panel-tab-static');
    expectCompactTabButton('right-panel-tab-references');
    expectCompactTabButton('right-panel-tab-outline');
    expect(screen.queryByText('AI Assistant')).not.toBeInTheDocument();
    expect(screen.getByTestId('assistant-panel-suspense-skeleton')).toBeInTheDocument();
    expect(screen.queryByText(/Loading assistant/i)).not.toBeInTheDocument();
  });

  it('removes the minimal layout outline around the panel tab header', () => {
    renderRightSidePanelInLayout('minimal');

    const header = screen.getByTestId('right-panel-header');

    expect(header).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');
    expect(header).toHaveClass('m-1.5', 'mb-0', 'rounded', 'px-2', 'py-1.5');
    expect(header).not.toHaveClass('border');
    expect(header).not.toHaveClass('border-border');
    expect(header).not.toHaveClass('border-b');
    expectCompactTabButton('right-panel-tab-ai');
    expectCompactTabButton('right-panel-tab-outline');
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
  }, PANEL_TEST_TIMEOUT_MS);

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
  }, PANEL_TEST_TIMEOUT_MS);

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
  }, PANEL_TEST_TIMEOUT_MS);
});
