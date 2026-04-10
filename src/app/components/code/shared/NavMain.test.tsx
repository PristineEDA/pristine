import { fireEvent, render, screen } from '@testing-library/react';
import { BugPlay, FileCode, LucideLayers3 } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarProvider } from '../../ui/sidebar';
import { NavMain } from './NavMain';

const items = [
  {
    id: 'explorer' as const,
    title: 'Editor',
    url: '#',
    icon: FileCode,
  },
  {
    id: 'simulation' as const,
    title: 'Simulation',
    url: '#',
    icon: BugPlay,
  },
  {
    id: 'physical' as const,
    title: 'Physical',
    url: '#',
    icon: LucideLayers3,
    isActive: true,
    items: [
      { title: 'Floorplan', url: '#floorplan' },
      { title: 'Route', url: '#route' },
    ],
  },
];

function renderNavMain({
  activeView = 'explorer',
  onItemSelect = vi.fn(),
}: {
  activeView?: string;
  onItemSelect?: (view: string) => void;
} = {}) {
  return render(
    <SidebarProvider defaultOpen keyboardShortcut={false}>
      <NavMain items={items} activeView={activeView} onItemSelect={onItemSelect} />
    </SidebarProvider>,
  );
}

describe('NavMain', () => {
  it('renders the platform section and top-level navigation items', () => {
    renderNavMain();

    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simulation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Physical' })).toBeInTheDocument();
  });

  it('forwards the clicked item id and marks the active item', () => {
    const onItemSelect = vi.fn();

    renderNavMain({ activeView: 'simulation', onItemSelect });

    const simulationButton = screen.getByTestId('activity-item-simulation');

    expect(simulationButton).toHaveAttribute('data-active', 'true');

    fireEvent.click(simulationButton);

    expect(onItemSelect).toHaveBeenCalledWith('simulation');
  });

  it('renders collapsible parent items and forwards the parent id when clicked', () => {
    const onItemSelect = vi.fn();

    renderNavMain({ onItemSelect });

    const physicalButton = screen.getByTestId('activity-item-physical');

    expect(physicalButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Floorplan')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Floorplan' })).toHaveAttribute('href', '#floorplan');

    fireEvent.click(physicalButton);

    expect(onItemSelect).toHaveBeenCalledWith('physical');
  });
});