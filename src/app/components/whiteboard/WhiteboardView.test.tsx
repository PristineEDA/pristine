import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhiteboardView } from './WhiteboardView';
import { mountBlockSuiteWhiteboard } from '../../whiteboard/blocksuiteAdapter';
import { createWhiteboardStore } from '../../whiteboard/createWhiteboardStore';

vi.mock('../../whiteboard/blocksuiteAdapter', () => ({
  mountBlockSuiteWhiteboard: vi.fn(),
}));

vi.mock('../../whiteboard/createWhiteboardStore', () => ({
  createWhiteboardStore: vi.fn(),
}));

describe('WhiteboardView', () => {
  const getWhiteboardHost = () => screen.getByTestId('whiteboard-host') as HTMLDivElement;

  const getMountedEditor = () => {
    const editor = getWhiteboardHost().shadowRoot?.querySelector('[data-testid="whiteboard-edgeless-editor"]');

    if (!editor) {
      throw new Error('Whiteboard editor is not mounted');
    }

    return editor;
  };

  beforeEach(() => {
    vi.mocked(createWhiteboardStore).mockImplementation(() => ({
      store: {} as never,
      workspace: {} as never,
      dispose: vi.fn(),
    }));
    vi.mocked(mountBlockSuiteWhiteboard).mockImplementation(({ host }) => {
      const editor = document.createElement('div') as never;
      (editor as HTMLElement).dataset.testid = 'whiteboard-edgeless-editor';
      host.append(editor as HTMLElement);

      return {
        editor,
        dispose: vi.fn(() => {
          (editor as HTMLElement).remove();
        }),
      };
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('mounts the BlockSuite editor into the host element', async () => {
    render(<WhiteboardView />);

    await waitFor(() => {
      expect(getMountedEditor()).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByText('Loading whiteboard...')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('whiteboard-view')).toHaveAttribute('data-theme', 'light');
    expect(getWhiteboardHost().shadowRoot).not.toBeNull();
    expect(mountBlockSuiteWhiteboard).toHaveBeenCalledTimes(1);
    expect(mountBlockSuiteWhiteboard).toHaveBeenCalledWith(expect.objectContaining({
      host: getWhiteboardHost().shadowRoot,
    }));
  });

  it('shows mount errors and retries on request', async () => {
    const user = userEvent.setup();
    vi.mocked(createWhiteboardStore)
      .mockImplementationOnce(() => {
        throw new Error('BlockSuite failed to mount');
      })
      .mockImplementationOnce(() => ({
        store: {} as never,
        workspace: {} as never,
        dispose: vi.fn(),
      }));

    render(<WhiteboardView />);

    expect(await screen.findByTestId('whiteboard-error')).toHaveTextContent('BlockSuite failed to mount');

    await user.click(screen.getByRole('button', { name: 'Retry whiteboard' }));

    await waitFor(() => {
      expect(getMountedEditor()).toBeInTheDocument();
    });
    expect(createWhiteboardStore).toHaveBeenCalledTimes(2);
  });
});
