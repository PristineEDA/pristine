import { useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

type WhiteboardNode = Node<{ label: string }>;


const proOptions = { hideAttribution: true };

export function WhiteboardView() {
  const [nodes, setNodes, onNodesChange] = useNodesState<WhiteboardNode>([]);
  const [edges, , onEdgesChange] = useEdgesState<Edge>([]);
  const [lastDraggedNodePosition, setLastDraggedNodePosition] = useState('none');

  const createNode = () => {
    const nextNodeIndex = nodes.length + 1;
    const nextNodeId = `node-${nextNodeIndex}`;

    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id: nextNodeId,
        position: {
          x: 96 + ((nextNodeIndex - 1) % 3) * 180,
          y: 96 + Math.floor((nextNodeIndex - 1) / 3) * 120,
        },
        data: { label: `Node ${nextNodeIndex}` },
        style: {
          borderRadius: 14,
          border: '1px solid rgba(148, 163, 184, 0.45)',
          background: 'rgba(255, 255, 255, 0.95)',
          color: '#0f172a',
          boxShadow: '0 18px 50px rgba(37, 99, 235, 0.08)',
          padding: '10px 14px',
          minWidth: 128,
          fontSize: 12,
          fontWeight: 600,
        },
      },
    ]);
  };

  return (
    <div data-testid="whiteboard-view" className="h-screen bg-[#f8fafc] text-slate-900">
      <div className="absolute left-5 top-5 z-20 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/88 px-4 py-3 shadow-[0_20px_45px_rgba(148,163,184,0.16)] backdrop-blur">
        <button
          type="button"
          data-testid="whiteboard-add-node"
          onClick={createNode}
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
        >
          Add node
        </button>
        <span data-testid="whiteboard-node-count" className="text-xs font-medium text-slate-600">
          Nodes: {nodes.length}
        </span>
        <span data-testid="whiteboard-last-dragged-node" className="text-xs font-medium text-slate-500">
          Last drag: {lastDraggedNodePosition}
        </span>
      </div>
      <ReactFlow
        data-testid="whiteboard-react-flow"
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={(_event, node) => {
          setLastDraggedNodePosition(`${node.id}:${Math.round(node.position.x)},${Math.round(node.position.y)}`);
        }}
        colorMode="light"
        minZoom={0.25}
        maxZoom={2}
        fitView={false}
        proOptions={proOptions}
      >
        <div data-testid="whiteboard-controls-wrapper">
          <Controls />
        </div>
        <MiniMap data-testid="whiteboard-minimap" pannable zoomable />
        <Background
          data-testid="whiteboard-background"
          variant={BackgroundVariant.Lines}
          gap={24}
          size={1}
          color="rgba(148, 163, 184, 0.4)"
        />
      </ReactFlow>
    </div>
  );
}
