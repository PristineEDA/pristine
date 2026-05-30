import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SchematicSettingsProvider, useSchematicSettings } from './SchematicSettingsContext';

function SchematicSettingsProbe() {
  const {
    alignmentGuidesEnabled,
    gridEnabled,
    gridSize,
    snapToGrid,
    setAlignmentGuidesEnabled,
    setGridEnabled,
    setGridSize,
    setSnapToGrid,
  } = useSchematicSettings();

  return (
    <div>
      <span data-testid="schematic-grid-enabled">{String(gridEnabled)}</span>
      <span data-testid="schematic-grid-size">{gridSize}</span>
      <span data-testid="schematic-snap-to-grid">{String(snapToGrid)}</span>
      <span data-testid="schematic-alignment-guides-enabled">{String(alignmentGuidesEnabled)}</span>
      <button data-testid="set-grid-enabled" onClick={() => setGridEnabled(false)}>Set grid enabled</button>
      <button data-testid="set-grid-size" onClick={() => setGridSize(24)}>Set grid size</button>
      <button data-testid="set-invalid-grid-size" onClick={() => setGridSize(99)}>Set invalid grid size</button>
      <button data-testid="set-snap-to-grid" onClick={() => setSnapToGrid(false)}>Set snap to grid</button>
      <button data-testid="set-alignment-guides" onClick={() => setAlignmentGuidesEnabled(false)}>Set alignment guides</button>
    </div>
  );
}

describe('SchematicSettingsContext', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.mocked(window.electronAPI!.config.get).mockReset();
    vi.mocked(window.electronAPI!.config.set).mockReset();
    vi.mocked(window.electronAPI!.config.onDidChange).mockReset();
    vi.mocked(window.electronAPI!.config.onDidChange).mockImplementation(() => vi.fn());
  });

  it('defaults to visible grid, snapping, and alignment guides', () => {
    render(
      <SchematicSettingsProvider>
        <SchematicSettingsProbe />
      </SchematicSettingsProvider>,
    );

    expect(screen.getByTestId('schematic-grid-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('schematic-grid-size')).toHaveTextContent('40');
    expect(screen.getByTestId('schematic-snap-to-grid')).toHaveTextContent('true');
    expect(screen.getByTestId('schematic-alignment-guides-enabled')).toHaveTextContent('true');
  });

  it('reads persisted schematic settings from config', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'schematic.grid.enabled'
        ? false
        : key === 'schematic.grid.size'
          ? 18
          : key === 'schematic.snapToGrid'
            ? false
            : key === 'schematic.alignmentGuides.enabled'
              ? false
              : null,
    );

    render(
      <SchematicSettingsProvider>
        <SchematicSettingsProbe />
      </SchematicSettingsProvider>,
    );

    expect(screen.getByTestId('schematic-grid-enabled')).toHaveTextContent('false');
    expect(screen.getByTestId('schematic-grid-size')).toHaveTextContent('18');
    expect(screen.getByTestId('schematic-snap-to-grid')).toHaveTextContent('false');
    expect(screen.getByTestId('schematic-alignment-guides-enabled')).toHaveTextContent('false');
  });

  it('persists schematic setting updates and clamps grid size', async () => {
    render(
      <SchematicSettingsProvider>
        <SchematicSettingsProbe />
      </SchematicSettingsProvider>,
    );

    await user.click(screen.getByTestId('set-grid-enabled'));
    expect(screen.getByTestId('schematic-grid-enabled')).toHaveTextContent('false');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('schematic.grid.enabled', false);

    await user.click(screen.getByTestId('set-grid-size'));
    expect(screen.getByTestId('schematic-grid-size')).toHaveTextContent('24');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('schematic.grid.size', 24);

    await user.click(screen.getByTestId('set-invalid-grid-size'));
    expect(screen.getByTestId('schematic-grid-size')).toHaveTextContent('60');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('schematic.grid.size', 60);

    await user.click(screen.getByTestId('set-snap-to-grid'));
    expect(screen.getByTestId('schematic-snap-to-grid')).toHaveTextContent('false');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('schematic.snapToGrid', false);

    await user.click(screen.getByTestId('set-alignment-guides'));
    expect(screen.getByTestId('schematic-alignment-guides-enabled')).toHaveTextContent('false');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('schematic.alignmentGuides.enabled', false);
  });

  it('syncs external config changes', () => {
    let onConfigChange: ((key: string, value: unknown) => void) | undefined;
    vi.mocked(window.electronAPI!.config.onDidChange).mockImplementation((handler) => {
      onConfigChange = handler;
      return vi.fn();
    });

    render(
      <SchematicSettingsProvider>
        <SchematicSettingsProbe />
      </SchematicSettingsProvider>,
    );

    act(() => {
      onConfigChange?.('schematic.grid.size', 12);
      onConfigChange?.('schematic.grid.enabled', false);
    });

    expect(screen.getByTestId('schematic-grid-size')).toHaveTextContent('12');
    expect(screen.getByTestId('schematic-grid-enabled')).toHaveTextContent('false');
  });
});
