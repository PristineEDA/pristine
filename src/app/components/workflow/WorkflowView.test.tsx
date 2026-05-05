import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/test/render';
import { WorkflowView } from './WorkflowView';
import { workflowCoverage, workflowNodes } from './workflowMockData';

const reactFlowMock = vi.hoisted(() => ({
  render: vi.fn(),
  onNodesChange: vi.fn(),
  onEdgesChange: vi.fn(),
}));

vi.mock('@xyflow/react', () => ({
  Background: ({ variant }: { variant?: string }) => <div data-testid="react-flow-background" data-variant={variant} />,
  BackgroundVariant: { Dots: 'dots', Lines: 'lines' },
  Controls: () => <div data-testid="react-flow-controls" />,
  Handle: ({ position, type }: { position: string; type: string }) => (
    <span data-testid={`react-flow-handle-${type}-${position}`} />
  ),
  MarkerType: { ArrowClosed: 'arrowclosed' },
  MiniMap: () => <div data-testid="react-flow-minimap" />,
  Panel: ({ children, position }: { children: ReactNode; position: string }) => (
    <div data-testid="react-flow-panel" data-position={position}>
      {children}
    </div>
  ),
  Position: { Top: 'top', Bottom: 'bottom' },
  ReactFlow: ({ children, edges = [], nodeTypes = {}, nodes = [], ...props }: any) => {
    reactFlowMock.render({ edges, nodeTypes, nodes, ...props });

    return (
      <div data-testid="react-flow" data-edge-count={edges.length} data-node-count={nodes.length}>
        {nodes.map((node: any) => {
          const NodeComponent = nodeTypes[node.type];

          if (!NodeComponent) {
            return null;
          }

          return (
            <div key={node.id} data-testid={`rendered-node-${node.id}`}>
              <NodeComponent
                id={node.id}
                type={node.type}
                data={node.data}
                selected={false}
                dragging={false}
                zIndex={0}
                isConnectable={false}
                positionAbsoluteX={node.position.x}
                positionAbsoluteY={node.position.y}
                xPos={node.position.x}
                yPos={node.position.y}
              />
            </div>
          );
        })}
        {children}
      </div>
    );
  },
  ReactFlowProvider: ({ children }: { children: ReactNode }) => <div data-testid="react-flow-provider">{children}</div>,
  useEdgesState: (edges: any[]) => [edges, undefined, reactFlowMock.onEdgesChange],
  useNodesState: (nodes: any[]) => [nodes, undefined, reactFlowMock.onNodesChange],
}));

describe('WorkflowView', () => {
  beforeEach(() => {
    reactFlowMock.render.mockClear();
    reactFlowMock.onNodesChange.mockClear();
    reactFlowMock.onEdgesChange.mockClear();
  });

  it('renders a full-page React Flow viewer shell', () => {
    render(<WorkflowView />);

    expect(screen.getByTestId('workflow-view')).toHaveClass('h-full', 'w-full');
    expect(screen.getByTestId('react-flow-provider')).toBeInTheDocument();
    expect(screen.getByTestId('react-flow')).toHaveAttribute('data-node-count', String(workflowNodes.length));
    expect(screen.getByTestId('react-flow-background')).toHaveAttribute('data-variant', 'dots');
    expect(screen.queryByTestId('react-flow-controls')).not.toBeInTheDocument();
    expect(screen.queryByTestId('react-flow-minimap')).not.toBeInTheDocument();
    expect(screen.getByTestId('react-flow-panel')).toHaveAttribute('data-position', 'top-left');
    expect(screen.getByText('mock-run-2026-05-03')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-animation-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('workflow-animation-toggle')).toHaveTextContent('Off');
  });

  it('toggles data flow edge animation without changing the graph structure', async () => {
    const user = userEvent.setup();

    render(<WorkflowView />);

    const toggle = screen.getByTestId('workflow-animation-toggle');
    const initialRender = reactFlowMock.render.mock.lastCall;
    expect(initialRender).toBeDefined();
    expect(initialRender![0].edges.every((edge: { animated?: boolean }) => edge.animated === false)).toBe(true);

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveTextContent('On');

    const toggledRender = reactFlowMock.render.mock.lastCall;
    expect(toggledRender).toBeDefined();
    expect(toggledRender![0].edges).toHaveLength(initialRender![0].edges.length);
    expect(toggledRender![0].edges.every((edge: { animated?: boolean }) => edge.animated === true)).toBe(true);
  });

  it('registers every Mastra Studio workflow node type', () => {
    render(<WorkflowView />);

    const renderCall = reactFlowMock.render.mock.calls[0];
    expect(renderCall).toBeDefined();
    const nodeTypes = renderCall![0].nodeTypes;

    expect(Object.keys(nodeTypes)).toEqual(expect.arrayContaining(workflowCoverage.nodeTypes));
  });

  it('shows mock coverage for all node designs, badges, and condition variants', () => {
    render(<WorkflowView />);

    expect(screen.getAllByTestId('workflow-default-node').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('workflow-condition-node').length).toBeGreaterThan(0);
    expect(screen.getByTestId('workflow-after-node')).toBeInTheDocument();
    expect(screen.getAllByTestId('workflow-loop-result-node')).toHaveLength(2);
    expect(screen.getByTestId('workflow-nested-node')).toBeInTheDocument();

    for (const badge of ['SLEEP', 'SLEEP UNTIL', 'FOREACH', 'MAP', 'PARALLEL', 'SUSPEND/RESUME', 'AFTER', 'WORKFLOW']) {
      expect(screen.getAllByText(badge).length).toBeGreaterThan(0);
    }

    for (const condition of ['WHEN', 'DO UNTIL', 'DO WHILE', 'UNTIL', 'WHILE', 'IF', 'ELSE']) {
      expect(screen.getAllByText(condition).length).toBeGreaterThan(0);
    }
  });

  it('keeps mock data aligned with the declared coverage matrix', () => {
    const nodeTypes = new Set(workflowNodes.map((node) => node.type));
    const badgeKinds = new Set(
      workflowNodes.flatMap((node) => {
        const badges = 'badges' in node.data && Array.isArray(node.data.badges) ? node.data.badges : [];
        return node.type === 'nested-node' && !badges.includes('workflow') ? ['workflow', ...badges] : badges;
      }),
    );
    const conditionTypes = new Set(
      workflowNodes.flatMap((node) => (node.type === 'condition-node' ? node.data.conditions.map((condition) => condition.type) : [])),
    );

    expect([...nodeTypes]).toEqual(expect.arrayContaining(workflowCoverage.nodeTypes));
    expect([...badgeKinds, 'after']).toEqual(expect.arrayContaining(workflowCoverage.badgeKinds));
    expect([...conditionTypes]).toEqual(expect.arrayContaining(workflowCoverage.conditionTypes));
  });
});