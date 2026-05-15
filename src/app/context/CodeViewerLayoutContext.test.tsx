import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CodeViewerLayoutProvider,
  WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY,
  parseCodeViewerLayoutMode,
  useCodeViewerLayout,
  type CodeViewerLayoutMode,
} from './CodeViewerLayoutContext';

function CodeViewerLayoutProbe() {
  const { layoutMode, setLayoutMode } = useCodeViewerLayout();

  return (
    <div>
      <span data-testid="code-viewer-layout-mode">{layoutMode}</span>
      <button data-testid="set-minimal-layout" onClick={() => setLayoutMode('minimal')}>
        Set minimal
      </button>
    </div>
  );
}

describe('CodeViewerLayoutContext', () => {
  beforeEach(() => {
    vi.mocked(window.electronAPI!.config.get).mockReset();
    vi.mocked(window.electronAPI!.config.set).mockReset();
    vi.mocked(window.electronAPI!.config.onDidChange).mockReset();
    vi.mocked(window.electronAPI!.config.onDidChange).mockImplementation(() => vi.fn());
  });

  it('defaults to compact when persisted config is missing or invalid', () => {
    expect(parseCodeViewerLayoutMode(null)).toBe('compact');
    expect(parseCodeViewerLayoutMode('unknown')).toBe('compact');

    render(
      <CodeViewerLayoutProvider>
        <CodeViewerLayoutProbe />
      </CodeViewerLayoutProvider>,
    );

    expect(screen.getByTestId('code-viewer-layout-mode')).toHaveTextContent('compact');
  });

  it('reads the persisted minimal layout mode', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY ? 'minimal' : null,
    );

    render(
      <CodeViewerLayoutProvider>
        <CodeViewerLayoutProbe />
      </CodeViewerLayoutProvider>,
    );

    expect(screen.getByTestId('code-viewer-layout-mode')).toHaveTextContent('minimal');
  });

  it('persists layout mode changes', async () => {
    const user = userEvent.setup();

    render(
      <CodeViewerLayoutProvider>
        <CodeViewerLayoutProbe />
      </CodeViewerLayoutProvider>,
    );

    await user.click(screen.getByTestId('set-minimal-layout'));

    expect(screen.getByTestId('code-viewer-layout-mode')).toHaveTextContent('minimal');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith(WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY, 'minimal');
  });

  it('syncs external config changes for the layout mode key only', () => {
    let configChangeListener: ((key: string, value: unknown) => void) | null = null;
    const unsubscribe = vi.fn();
    vi.mocked(window.electronAPI!.config.onDidChange).mockImplementation((listener) => {
      configChangeListener = listener;
      return unsubscribe;
    });

    const { unmount } = render(
      <CodeViewerLayoutProvider>
        <CodeViewerLayoutProbe />
      </CodeViewerLayoutProvider>,
    );

    act(() => {
      configChangeListener?.('workbench.colorTheme', 'minimal');
    });

    expect(screen.getByTestId('code-viewer-layout-mode')).toHaveTextContent('compact');

    act(() => {
      configChangeListener?.(WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY, 'minimal' satisfies CodeViewerLayoutMode);
    });

    expect(screen.getByTestId('code-viewer-layout-mode')).toHaveTextContent('minimal');

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('falls back to compact for isolated component renders without a provider', () => {
    render(<CodeViewerLayoutProbe />);

    expect(screen.getByTestId('code-viewer-layout-mode')).toHaveTextContent('compact');
  });
});