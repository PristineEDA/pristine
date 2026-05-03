import { useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { workflowEdges, workflowMetadata, workflowNodes } from './workflowMockData';
import { workflowNodeTypes } from './workflowNodes';

interface WorkflowViewProps {
  title?: string;
  description?: string;
  testId?: string;
}

export function WorkflowView({
  title = 'Workflow',
  description = 'Mock Mastra workflow graph',
  testId = 'workflow-view',
}: WorkflowViewProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas title={title} description={description} testId={testId} />
    </ReactFlowProvider>
  );
}

function WorkflowCanvas({ title, description, testId }: Required<WorkflowViewProps>) {
  const [showDataFlowAnimation, setShowDataFlowAnimation] = useState(true);
  const [nodes, , onNodesChange] = useNodesState(workflowNodes);
  const [baseEdges, , onEdgesChange] = useEdgesState(workflowEdges);
  const edges = useMemo(
    () =>
      baseEdges.map((edge) => (edge.animated === showDataFlowAnimation ? edge : { ...edge, animated: showDataFlowAnimation })),
    [baseEdges, showDataFlowAnimation],
  );
  const nodeTypes = useMemo(() => workflowNodeTypes, []);
  const fitViewOptions = useMemo(() => ({ maxZoom: 1, padding: 0.16 }), []);
  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  return (
    <div data-testid={testId} className="h-full min-h-0 w-full overflow-hidden bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={fitViewOptions}
        minZoom={0.08}
        maxZoom={1}
        nodesConnectable={false}
        nodesDraggable={false}
        proOptions={proOptions}
      >
        <Panel position="top-left" className="max-w-sm rounded-md border border-border bg-background/95 p-3 text-foreground shadow-sm backdrop-blur">
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium leading-5">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="bg-background/80 text-[10px] uppercase tracking-normal">
                {workflowMetadata.status}
              </Badge>
              <Badge variant="outline" className="bg-background/80 text-[10px] tracking-normal">
                {workflowNodes.length} nodes
              </Badge>
              <span className="truncate text-[11px] text-muted-foreground">{workflowMetadata.runId}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted-foreground">Data flow animation</span>
              <Button
                type="button"
                variant={showDataFlowAnimation ? 'secondary' : 'outline'}
                size="xs"
                data-testid="workflow-animation-toggle"
                aria-pressed={showDataFlowAnimation}
                aria-label={showDataFlowAnimation ? 'Disable data flow animation' : 'Enable data flow animation'}
                onClick={() => setShowDataFlowAnimation((current) => !current)}
              >
                {showDataFlowAnimation ? 'On' : 'Off'}
              </Button>
            </div>
          </div>
        </Panel>
        <MiniMap pannable zoomable nodeStrokeWidth={3} className="border border-border bg-background/95" />
        <Controls position="bottom-left" showInteractive={false} />
        <Background variant={BackgroundVariant.Dots} gap={12} size={0.5} />
      </ReactFlow>
    </div>
  );
}
