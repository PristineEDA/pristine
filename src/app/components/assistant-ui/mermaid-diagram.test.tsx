import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MermaidDiagram, type MermaidDiagramProps } from './mermaid-diagram';

const mocks = vi.hoisted(() => ({
  bindFunctions: vi.fn(),
  initialize: vi.fn(),
  partText: '',
  render: vi.fn(),
}));

vi.mock('@assistant-ui/react', () => ({
  useAuiState: (selector: (state: { part: { type: string; text: string } }) => boolean) => selector({
    part: {
      type: 'text',
      text: mocks.partText,
    },
  }),
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: mocks.initialize,
    render: mocks.render,
  },
}));

function renderMermaidDiagram(props: Pick<MermaidDiagramProps, 'code'> & Partial<MermaidDiagramProps>) {
  return render(
    <MermaidDiagram
      components={{} as MermaidDiagramProps['components']}
      language="mermaid"
      {...props}
    />,
  );
}

describe('MermaidDiagram', () => {
  beforeEach(() => {
    mocks.bindFunctions.mockReset();
    mocks.partText = '';
    mocks.render.mockReset();
  });

  it('renders a completed mermaid block into SVG and binds diagram functions', async () => {
    const code = 'graph LR\n  A --> B';
    mocks.partText = `Before\n\`\`\`mermaid\n${code}\n\`\`\`\nAfter`;
    mocks.render.mockResolvedValueOnce({
      svg: '<svg role="img"><title>Flow</title></svg>',
      bindFunctions: mocks.bindFunctions,
    });

    const { container } = renderMermaidDiagram({ className: 'custom-diagram', code });

    const root = container.querySelector('.aui-mermaid-diagram');
    expect(root).toHaveClass('custom-diagram');
    expect(root).toHaveTextContent('Drawing diagram...');

    await waitFor(() => {
      expect(mocks.render).toHaveBeenCalledWith(expect.stringMatching(/^mermaid-/), code);
    });
    await waitFor(() => {
      expect(root?.innerHTML).toContain('<svg');
    });
    expect(mocks.bindFunctions).toHaveBeenCalledWith(root);
  });

  it('waits for the closing fence before rendering', () => {
    const code = 'graph TD\n  A --> B';
    mocks.partText = `\`\`\`mermaid\n${code}`;

    renderMermaidDiagram({ code });

    expect(mocks.render).not.toHaveBeenCalled();
  });

  it('logs render failures without throwing away the placeholder', async () => {
    const code = 'graph LR\n  A --> B';
    const error = new Error('invalid graph');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.partText = `\`\`\`mermaid\n${code}\n\`\`\``;
    mocks.render.mockRejectedValueOnce(error);

    const { container } = renderMermaidDiagram({ code });

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith('Failed to render Mermaid diagram:', error);
    });
    expect(container.querySelector('.aui-mermaid-diagram')).toHaveTextContent('Drawing diagram...');

    warnSpy.mockRestore();
  });
});