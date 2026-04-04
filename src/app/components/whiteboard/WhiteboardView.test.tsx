import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WhiteboardView } from './WhiteboardView';

describe('WhiteboardView', () => {
  it('renders the minimal React Flow whiteboard surface', () => {
    const { container } = render(<WhiteboardView />);

    expect(screen.getByTestId('whiteboard-view')).toBeInTheDocument();
    expect(screen.getByTestId('whiteboard-view')).toHaveClass('bg-[#f8fafc]', 'text-slate-900');
    expect(screen.getByTestId('whiteboard-controls-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('whiteboard-node-count')).toHaveTextContent('Nodes: 0');
    expect(screen.getByTestId('whiteboard-last-dragged-node')).toHaveTextContent('Last drag: none');
    expect(container.querySelector('.react-flow')).not.toBeNull();
    expect(screen.getByTestId('whiteboard-react-flow')).toHaveClass('light');
    expect(container.querySelector('.react-flow__controls')).not.toBeNull();
    expect(screen.getByTestId('rf__minimap')).toBeInTheDocument();
    expect(screen.getByTestId('rf__background')).toBeInTheDocument();
    expect(container.querySelector('.react-flow__minimap')).not.toBeNull();
    expect(container.querySelector('.react-flow__background')).not.toBeNull();
    expect(container.querySelector('.react-flow__background-pattern.lines')).not.toBeNull();
  });

  it('creates nodes from the whiteboard toolbar', () => {
    render(<WhiteboardView />);

    fireEvent.click(screen.getByTestId('whiteboard-add-node'));
    fireEvent.click(screen.getByTestId('whiteboard-add-node'));

    expect(screen.getByTestId('whiteboard-node-count')).toHaveTextContent('Nodes: 2');
    expect(screen.getByText('Node 1')).toBeInTheDocument();
    expect(screen.getByText('Node 2')).toBeInTheDocument();
  });
});