import { MarkerType, type Edge } from '@xyflow/react';
import type { WorkflowBadgeKind, WorkflowConditionType, WorkflowNode, WorkflowStepStatus } from './workflowNodes';

export interface WorkflowEdgeData extends Record<string, unknown> {
  previousStepId: string;
  nextStepId: string;
  conditionNode?: boolean;
}

export type WorkflowEdge = Edge<WorkflowEdgeData>;

export const workflowMetadata = {
  name: 'Pristine Agent Workflow',
  runId: 'mock-run-2026-05-03',
  status: 'running' satisfies WorkflowStepStatus,
};

const nodeColumn = {
  left: -760,
  center: -420,
  right: -80,
  branch: 300,
  gallery: 660,
};

export const workflowNodes: WorkflowNode[] = [
  {
    id: 'trigger-intake',
    type: 'default-node',
    position: { x: nodeColumn.center, y: -500 },
    data: {
      label: 'Trigger intake',
      stepId: 'trigger',
      description: 'Collects request context from the active workspace.',
      status: 'success',
      withoutTopHandle: true,
    },
  },
  {
    id: 'normalize-request',
    type: 'default-node',
    position: { x: nodeColumn.center, y: -325 },
    data: {
      label: 'Normalize request',
      stepId: 'normalizeRequest',
      description: 'Shapes the request into a workflow-safe payload.',
      status: 'success',
    },
  },
  {
    id: 'condition-when',
    type: 'condition-node',
    position: { x: nodeColumn.center, y: -130 },
    data: {
      label: 'Workspace ready',
      previousStepId: 'normalize-request',
      nextStepId: 'map-workspace',
      status: 'success',
      conditions: [
        {
          type: 'when',
          source: 'trigger',
          path: 'workspace.ready',
          query: 'is true',
        },
        {
          type: 'when',
          source: 'trigger',
          path: 'mode',
          query: 'equals agent',
          conj: 'and',
        },
      ],
    },
  },
  {
    id: 'map-workspace',
    type: 'default-node',
    position: { x: nodeColumn.left, y: 95 },
    data: {
      label: 'Workspace map',
      stepId: 'mapWorkspace',
      description: 'Maps open files into compact context chunks.',
      status: 'success',
      badges: ['map'],
      metadata: 'mapConfig: active files, symbols, diagnostics',
    },
  },
  {
    id: 'parallel-analysis',
    type: 'default-node',
    position: { x: nodeColumn.center, y: 95 },
    data: {
      label: 'Parallel analysis',
      stepId: 'parallelAnalysis',
      description: 'Runs project, test, and dependency analysis together.',
      status: 'running',
      badges: ['parallel'],
    },
  },
  {
    id: 'human-approval',
    type: 'default-node',
    position: { x: nodeColumn.right, y: 95 },
    data: {
      label: 'Human approval',
      stepId: 'humanApproval',
      description: 'Suspends while the user reviews proposed actions.',
      status: 'suspended',
      badges: ['suspend'],
    },
  },
  {
    id: 'sleep-backoff',
    type: 'default-node',
    position: { x: nodeColumn.left, y: 315 },
    data: {
      label: 'Retry backoff',
      stepId: 'sleepBackoff',
      description: 'Waits before polling the local agent server again.',
      status: 'waiting',
      badges: ['sleep'],
      durationMs: 2500,
    },
  },
  {
    id: 'sleep-until-release',
    type: 'default-node',
    position: { x: nodeColumn.center, y: 315 },
    data: {
      label: 'Release window',
      stepId: 'sleepUntilRelease',
      description: 'Holds deployment work until the mock release window.',
      status: 'waiting',
      badges: ['sleepUntil'],
      date: '2026-05-03T18:30:00.000Z',
    },
  },
  {
    id: 'foreach-files',
    type: 'default-node',
    position: { x: nodeColumn.right, y: 315 },
    data: {
      label: 'File pass',
      stepId: 'foreachFiles',
      description: 'Applies the same review step to each changed file.',
      status: 'running',
      badges: ['forEach'],
      progress: { completed: 7, total: 12, label: 'files' },
    },
  },
  {
    id: 'nested-remediation',
    type: 'nested-node',
    position: { x: nodeColumn.branch, y: 315 },
    data: {
      label: 'Nested remediation',
      stepId: 'remediationWorkflow',
      description: 'Delegates a focused repair sequence to a nested workflow.',
      status: 'idle',
      badges: ['workflow'],
      nestedSteps: ['plan patch', 'apply patch', 'verify patch'],
    },
  },
  {
    id: 'after-join',
    type: 'after-node',
    position: { x: nodeColumn.center, y: 570 },
    data: {
      steps: ['mapWorkspace', 'parallelAnalysis', 'humanApproval', 'foreachFiles'],
    },
  },
  {
    id: 'loop-review',
    type: 'default-node',
    position: { x: nodeColumn.left, y: 760 },
    data: {
      label: 'Review loop',
      stepId: 'reviewLoop',
      description: 'Repeats until the mock confidence threshold is met.',
      status: 'tripwire',
    },
  },
  {
    id: 'condition-dountil',
    type: 'condition-node',
    position: { x: nodeColumn.left, y: 955 },
    data: {
      label: 'Loop condition',
      previousStepId: 'loop-review',
      nextStepId: 'loop-result-true',
      status: 'tripwire',
      conditions: [
        {
          type: 'dountil',
          fnString: 'async ({ inputData }) => inputData.confidence >= 0.92',
        },
      ],
    },
  },
  {
    id: 'loop-result-true',
    type: 'loop-result-node',
    position: { x: nodeColumn.left - 170, y: 1190 },
    data: {
      result: true,
    },
  },
  {
    id: 'loop-result-false',
    type: 'loop-result-node',
    position: { x: nodeColumn.left + 170, y: 1190 },
    data: {
      result: false,
    },
  },
  {
    id: 'condition-if',
    type: 'condition-node',
    position: { x: nodeColumn.gallery, y: -500 },
    data: {
      label: 'IF branch',
      previousStepId: 'normalize-request',
      nextStepId: 'parallel-analysis',
      status: 'success',
      conditions: [{ type: 'if', source: 'normalizeRequest', path: 'intent', query: 'equals edit' }],
    },
  },
  {
    id: 'condition-else',
    type: 'condition-node',
    position: { x: nodeColumn.gallery, y: -305 },
    data: {
      label: 'ELSE branch',
      previousStepId: 'condition-if',
      nextStepId: 'human-approval',
      status: 'idle',
      conditions: [{ type: 'else' }],
    },
  },
  {
    id: 'condition-while',
    type: 'condition-node',
    position: { x: nodeColumn.gallery, y: -155 },
    data: {
      label: 'WHILE loop',
      previousStepId: 'foreach-files',
      nextStepId: 'after-join',
      status: 'running',
      conditions: [{ type: 'while', fnString: 'async ({ inputData }) => inputData.remaining > 0' }],
    },
  },
  {
    id: 'condition-until',
    type: 'condition-node',
    position: { x: nodeColumn.gallery, y: 70 },
    data: {
      label: 'UNTIL gate',
      previousStepId: 'sleep-until-release',
      nextStepId: 'after-join',
      status: 'waiting',
      conditions: [{ type: 'until', source: 'releaseWindow', path: 'openedAt', query: 'is reached' }],
    },
  },
  {
    id: 'condition-dowhile',
    type: 'condition-node',
    position: { x: nodeColumn.gallery, y: 290 },
    data: {
      label: 'DO WHILE loop',
      previousStepId: 'nested-remediation',
      nextStepId: 'after-join',
      status: 'success',
      conditions: [{ type: 'dowhile', fnString: 'async ({ inputData }) => inputData.patchCount < 3' }],
    },
  },
];

const baseEdge = {
  animated: true,
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 18,
    height: 18,
    color: '#8e8e8e',
  },
  style: {
    stroke: '#8e8e8e',
    strokeWidth: 1.5,
  },
} satisfies Pick<WorkflowEdge, 'animated' | 'type' | 'markerEnd' | 'style'>;

function makeEdge(source: string, target: string, data?: Partial<WorkflowEdgeData>): WorkflowEdge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    data: {
      previousStepId: source,
      nextStepId: target,
      ...data,
    },
    ...baseEdge,
  };
}

export const workflowEdges: WorkflowEdge[] = [
  makeEdge('trigger-intake', 'normalize-request'),
  makeEdge('normalize-request', 'condition-when'),
  makeEdge('condition-when', 'map-workspace', { conditionNode: true }),
  makeEdge('condition-when', 'parallel-analysis', { conditionNode: true }),
  makeEdge('condition-when', 'human-approval', { conditionNode: true }),
  makeEdge('map-workspace', 'sleep-backoff'),
  makeEdge('parallel-analysis', 'sleep-until-release'),
  makeEdge('human-approval', 'foreach-files'),
  makeEdge('foreach-files', 'nested-remediation'),
  makeEdge('sleep-backoff', 'after-join'),
  makeEdge('sleep-until-release', 'after-join'),
  makeEdge('foreach-files', 'after-join'),
  makeEdge('nested-remediation', 'after-join'),
  makeEdge('after-join', 'loop-review'),
  makeEdge('loop-review', 'condition-dountil'),
  makeEdge('condition-dountil', 'loop-result-true', { conditionNode: true }),
  makeEdge('condition-dountil', 'loop-result-false', { conditionNode: true }),
  makeEdge('normalize-request', 'condition-if'),
  makeEdge('condition-if', 'condition-else', { conditionNode: true }),
  makeEdge('condition-else', 'condition-while', { conditionNode: true }),
  makeEdge('condition-while', 'condition-until', { conditionNode: true }),
  makeEdge('condition-until', 'condition-dowhile', { conditionNode: true }),
];

export const workflowCoverage = {
  nodeTypes: ['default-node', 'condition-node', 'after-node', 'loop-result-node', 'nested-node'],
  badgeKinds: ['sleep', 'sleepUntil', 'forEach', 'map', 'parallel', 'suspend', 'after', 'workflow'] satisfies WorkflowBadgeKind[],
  conditionTypes: ['when', 'dountil', 'dowhile', 'until', 'while', 'if', 'else'] satisfies WorkflowConditionType[],
};
