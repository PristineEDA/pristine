import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActivityBar } from './ActivityBar';
import { SidebarProvider } from '../../ui/sidebar';

function renderActivityBar({
  activeView = 'explorer',
  onItemSelect = vi.fn(),
  defaultOpen = false,
}: {
  activeView?: string;
  onItemSelect?: (view: string) => void;
  defaultOpen?: boolean;
} = {}) {
  return render(
    <SidebarProvider defaultOpen={defaultOpen} keyboardShortcut={false}>
      <ActivityBar activeView={activeView} onItemSelect={onItemSelect} />
    </SidebarProvider>,
  );
}

describe('ActivityBar', () => {
  it('renders compile and run action buttons and removes settings', () => {
    renderActivityBar();

    const buttons = [
      screen.getByTestId('activity-action-compile'),
      screen.getByTestId('activity-action-run'),
    ];

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Compile', 'Run']);
    expect(screen.queryByTestId('activity-action-debug-action')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simulation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Extensions' })).not.toBeInTheDocument();
  });

  it('does not apply pressed state or call the shared navigation handler when compile and run are clicked', async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();

    renderActivityBar({ onItemSelect });

    const compileButton = screen.getByTestId('activity-action-compile');
    const runButton = screen.getByTestId('activity-action-run');

    expect(compileButton).not.toHaveAttribute('aria-pressed');
    expect(runButton).not.toHaveAttribute('aria-pressed');

    await user.click(runButton);

    expect(compileButton).not.toHaveAttribute('aria-pressed');
    expect(runButton).not.toHaveAttribute('aria-pressed');
    expect(onItemSelect).not.toHaveBeenCalled();
  });

  it('forwards clicked item ids to the shared selection handler', async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();

    renderActivityBar({ onItemSelect });

    await user.click(screen.getByTestId('activity-item-simulation'));
    await user.click(screen.getByTestId('activity-item-explorer'));

    expect(onItemSelect).toHaveBeenNthCalledWith(1, 'simulation');
    expect(onItemSelect).toHaveBeenNthCalledWith(2, 'explorer');
  });

  it('forwards the id for collapsible top-level items to the shared selection handler', async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();

    renderActivityBar({ onItemSelect });

    await user.click(screen.getByTestId('activity-item-physical'));

    expect(onItemSelect).toHaveBeenCalledWith('physical');
  });

  it('uses the selected button style for the active item', () => {
    renderActivityBar();

    const explorerButton = screen.getByTestId('activity-item-explorer');

    expect(explorerButton).toHaveAttribute('data-active', 'true');
    expect(explorerButton).toHaveClass('rounded-md', 'data-[active=true]:bg-sidebar-accent', 'data-[active=true]:text-sidebar-accent-foreground');
  });

  it('adds a pointer cursor on hover for navigation and action buttons', () => {
    renderActivityBar();

    expect(screen.getByTestId('activity-item-explorer')).toHaveClass('cursor-pointer');
    expect(screen.getByTestId('activity-item-simulation')).toHaveClass('hover:bg-sidebar-accent');
    expect(screen.getByTestId('activity-action-compile')).toHaveClass('hover:cursor-pointer', 'hover:bg-muted');
  });

  it('renders shadcn tooltip content for navigation and action buttons on hover', async () => {
    const user = userEvent.setup();

    renderActivityBar();

    await user.hover(screen.getByTestId('activity-item-explorer'));
    expect(await screen.findByRole('tooltip', { name: 'Editor' })).toBeInTheDocument();
  });

  it('keeps labels hidden while collapsed and shows them when expanded', () => {
    const { unmount } = renderActivityBar({ defaultOpen: false });

    expect(screen.queryByText('Compile')).not.toBeInTheDocument();
    expect(screen.queryByText('Run')).not.toBeInTheDocument();
    expect(screen.getByText('Physical')).toBeInTheDocument();

    unmount();
    renderActivityBar({ defaultOpen: true });

    expect(screen.getByText('Physical')).toBeInTheDocument();
    expect(screen.getByText('Compile')).toBeInTheDocument();
    expect(screen.getByText('Run')).toBeInTheDocument();
  });
});
