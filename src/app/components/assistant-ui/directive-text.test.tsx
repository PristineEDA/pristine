import { render, screen } from '@testing-library/react';
import { FileCode2 } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import {
  createDirectiveText,
  defaultDirectiveFormatter,
} from './directive-text';

describe('DirectiveText', () => {
  it('renders assistant-ui directive syntax as inline chips', () => {
    const Text = createDirectiveText(defaultDirectiveFormatter, {
      iconMap: { context: FileCode2 },
    });

    render(
      <div>
        <Text
          type="text"
          text="Use :context[Workspace]{name=workspace} before :tool[Shell]{name=propose_shell_command}"
          status={{ type: 'complete' }}
        />
      </div>,
    );

    const workspaceChip = screen.getByLabelText('context: Workspace');
    const shellChip = screen.getByLabelText('tool: Shell');

    expect(workspaceChip).toHaveAttribute('data-slot', 'directive-text-chip');
    expect(workspaceChip).toHaveAttribute('data-directive-type', 'context');
    expect(workspaceChip).toHaveAttribute('data-directive-id', 'workspace');
    expect(workspaceChip).toHaveTextContent('Workspace');

    expect(shellChip).toHaveAttribute('data-directive-type', 'tool');
    expect(shellChip).toHaveAttribute('data-directive-id', 'propose_shell_command');
    expect(shellChip).toHaveTextContent('Shell');
  });

  it('leaves plain text unchanged when no directive syntax is present', () => {
    const Text = createDirectiveText(defaultDirectiveFormatter);

    render(<Text type="text" text="Plain composer text" status={{ type: 'complete' }} />);

    expect(screen.getByText('Plain composer text')).toBeInTheDocument();
    expect(screen.queryByLabelText(/:/)).not.toBeInTheDocument();
  });
});