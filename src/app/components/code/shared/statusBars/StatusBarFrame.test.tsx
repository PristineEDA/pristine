import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CodeViewerLayoutProvider,
  WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY,
  type CodeViewerLayoutMode,
} from '../../../../context/CodeViewerLayoutContext';
import { StatusBarFrame } from './StatusBarFrame';

function renderStatusBarFrame(layoutMode: CodeViewerLayoutMode) {
  vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
    key === WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY ? layoutMode : null,
  );

  return render(
    <CodeViewerLayoutProvider>
      <StatusBarFrame
        left={<span>Left status</span>}
        right={<span>Right status</span>}
        statusBarId="test-status-bar"
      />
    </CodeViewerLayoutProvider>,
  );
}

describe('StatusBarFrame', () => {
  it('keeps the compact status bar top border', () => {
    renderStatusBarFrame('compact');

    expect(screen.getByTestId('status-bar')).toHaveAttribute('data-code-viewer-layout-mode', 'compact');
    expect(screen.getByTestId('status-bar')).toHaveClass('border-t', 'border-ide-statusbar-border');
  });

  it('removes the status bar top border in minimal layout', () => {
    renderStatusBarFrame('minimal');

    expect(screen.getByTestId('status-bar')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');
    expect(screen.getByTestId('status-bar')).not.toHaveClass('border-t');
    expect(screen.getByTestId('status-bar')).not.toHaveClass('border-ide-statusbar-border');
    expect(screen.getByTestId('status-bar')).toHaveClass('bg-ide-unified-chrome-bg', 'text-ide-unified-chrome-fg');
  });
});