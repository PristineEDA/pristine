import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkspaceProvider, useWorkspace } from '../../context/WorkspaceContext';

/**
 * Simple harness that exposes the mainContentView state + buttons to switch it.
 * This tests the context-level view switching without importing heavy components.
 */
function ViewSwitchHarness() {
  const { mainContentView, setMainContentView } = useWorkspace();
  return (
    <div>
      <span data-testid="current-view">{mainContentView}</span>
      <button data-testid="switch-code" onClick={() => setMainContentView('code')}>code</button>
      <button data-testid="switch-whiteboard" onClick={() => setMainContentView('whiteboard')}>whiteboard</button>
      <button data-testid="switch-workflow" onClick={() => setMainContentView('workflow')}>workflow</button>

      {mainContentView === 'code' && <div data-testid="code-view" />}
      {mainContentView === 'whiteboard' && <div data-testid="whiteboard-view" />}
      {mainContentView === 'workflow' && <div data-testid="workflow-view" />}
    </div>
  );
}

function renderHarness() {
  return render(
    <WorkspaceProvider>
      <ViewSwitchHarness />
    </WorkspaceProvider>,
  );
}

describe('View switching (code / whiteboard / workflow)', () => {
  it('defaults to code view', () => {
    renderHarness();
    expect(screen.getByTestId('current-view').textContent).toBe('code');
    expect(screen.getByTestId('code-view')).toBeTruthy();
    expect(screen.queryByTestId('whiteboard-view')).toBeNull();
    expect(screen.queryByTestId('workflow-view')).toBeNull();
  });

  it('switches to whiteboard view', () => {
    renderHarness();
    fireEvent.click(screen.getByTestId('switch-whiteboard'));
    expect(screen.getByTestId('current-view').textContent).toBe('whiteboard');
    expect(screen.getByTestId('whiteboard-view')).toBeTruthy();
    expect(screen.queryByTestId('code-view')).toBeNull();
  });

  it('switches to workflow view', () => {
    renderHarness();
    fireEvent.click(screen.getByTestId('switch-workflow'));
    expect(screen.getByTestId('current-view').textContent).toBe('workflow');
    expect(screen.getByTestId('workflow-view')).toBeTruthy();
    expect(screen.queryByTestId('code-view')).toBeNull();
  });

  it('switches back to code view from whiteboard', () => {
    renderHarness();
    fireEvent.click(screen.getByTestId('switch-whiteboard'));
    expect(screen.getByTestId('whiteboard-view')).toBeTruthy();

    fireEvent.click(screen.getByTestId('switch-code'));
    expect(screen.getByTestId('current-view').textContent).toBe('code');
    expect(screen.getByTestId('code-view')).toBeTruthy();
    expect(screen.queryByTestId('whiteboard-view')).toBeNull();
  });
});
