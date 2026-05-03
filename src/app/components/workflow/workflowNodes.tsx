import { Handle, Position, type Node, type NodeProps, type NodeTypes } from '@xyflow/react';
import type { ComponentType, CSSProperties } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  CirclePause,
  CircleX,
  Clock,
  CornerDownRight,
  Footprints,
  GitBranch,
  Layers,
  List,
  Loader2,
  Network,
  PlayCircle,
  RefreshCw,
  Repeat,
  Repeat1,
  ShieldAlert,
  Timer,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/lib/utils';

export type WorkflowStepStatus = 'idle' | 'running' | 'success' | 'failed' | 'suspended' | 'waiting' | 'tripwire';

export type WorkflowBadgeKind =
  | 'sleep'
  | 'sleepUntil'
  | 'forEach'
  | 'map'
  | 'parallel'
  | 'suspend'
  | 'after'
  | 'workflow';

export type WorkflowConditionType = 'when' | 'dountil' | 'dowhile' | 'until' | 'while' | 'if' | 'else';

export interface WorkflowCondition {
  type: WorkflowConditionType;
  source?: string;
  path?: string;
  query?: string;
  conj?: 'and' | 'or' | 'not';
  fnString?: string;
}

interface WorkflowBaseNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  status?: WorkflowStepStatus;
  withoutTopHandle?: boolean;
  withoutBottomHandle?: boolean;
}

export interface WorkflowDefaultNodeData extends WorkflowBaseNodeData {
  stepId?: string;
  badges?: WorkflowBadgeKind[];
  durationMs?: number;
  date?: string;
  progress?: {
    completed: number;
    total: number;
    label?: string;
  };
  metadata?: string;
}

export interface WorkflowConditionNodeData extends WorkflowBaseNodeData {
  conditions: WorkflowCondition[];
  previousStepId: string;
  nextStepId: string;
}

export interface WorkflowAfterNodeData extends Record<string, unknown> {
  steps: string[];
}

export interface WorkflowLoopResultNodeData extends Record<string, unknown> {
  result: boolean;
}

export interface WorkflowNestedNodeData extends WorkflowBaseNodeData {
  stepId?: string;
  badges?: WorkflowBadgeKind[];
  nestedSteps: string[];
}

export type WorkflowDefaultNodeType = Node<WorkflowDefaultNodeData, 'default-node'>;
export type WorkflowConditionNodeType = Node<WorkflowConditionNodeData, 'condition-node'>;
export type WorkflowAfterNodeType = Node<WorkflowAfterNodeData, 'after-node'>;
export type WorkflowLoopResultNodeType = Node<WorkflowLoopResultNodeData, 'loop-result-node'>;
export type WorkflowNestedNodeType = Node<WorkflowNestedNodeData, 'nested-node'>;

export type WorkflowNode =
  | WorkflowDefaultNodeType
  | WorkflowConditionNodeType
  | WorkflowAfterNodeType
  | WorkflowLoopResultNodeType
  | WorkflowNestedNodeType;

const hiddenHandleStyle = { visibility: 'hidden' } satisfies CSSProperties;

const badgeConfig: Record<WorkflowBadgeKind, { label: string; icon: LucideIcon; color: string }> = {
  sleep: { label: 'SLEEP', icon: Timer, color: '#A855F7' },
  sleepUntil: { label: 'SLEEP UNTIL', icon: CalendarClock, color: '#A855F7' },
  forEach: { label: 'FOREACH', icon: List, color: '#F97316' },
  map: { label: 'MAP', icon: List, color: '#F97316' },
  parallel: { label: 'PARALLEL', icon: Workflow, color: '#3B82F6' },
  suspend: { label: 'SUSPEND/RESUME', icon: PlayCircle, color: '#EC4899' },
  after: { label: 'AFTER', icon: Clock, color: '#14B8A6' },
  workflow: { label: 'WORKFLOW', icon: Layers, color: '#8B5CF6' },
};

const conditionConfig: Record<WorkflowConditionType, { label: string; icon: LucideIcon; color: string }> = {
  when: { label: 'WHEN', icon: Network, color: '#ECB047' },
  dountil: { label: 'DO UNTIL', icon: Repeat1, color: '#8B5CF6' },
  dowhile: { label: 'DO WHILE', icon: Repeat, color: '#06B6D4' },
  until: { label: 'UNTIL', icon: Timer, color: '#F59E0B' },
  while: { label: 'WHILE', icon: RefreshCw, color: '#10B981' },
  if: { label: 'IF', icon: GitBranch, color: '#3B82F6' },
  else: { label: 'ELSE', icon: CornerDownRight, color: '#6B7280' },
};

const statusConfig: Record<WorkflowStepStatus, { label: string; icon: LucideIcon; iconClassName: string; cardClassName: string }> = {
  idle: {
    label: 'idle',
    icon: CircleDashed,
    iconClassName: 'text-muted-foreground',
    cardClassName: 'border-border bg-card',
  },
  running: {
    label: 'running',
    icon: Loader2,
    iconClassName: 'animate-spin text-sky-400',
    cardClassName: 'border-sky-500/35 bg-sky-950/20',
  },
  success: {
    label: 'success',
    icon: CheckCircle2,
    iconClassName: 'text-emerald-400',
    cardClassName: 'border-emerald-500/35 bg-emerald-950/20',
  },
  failed: {
    label: 'failed',
    icon: CircleX,
    iconClassName: 'text-rose-400',
    cardClassName: 'border-rose-500/35 bg-rose-950/20',
  },
  suspended: {
    label: 'suspended',
    icon: CirclePause,
    iconClassName: 'text-pink-400',
    cardClassName: 'border-pink-500/35 bg-pink-950/20',
  },
  waiting: {
    label: 'waiting',
    icon: Clock,
    iconClassName: 'text-amber-400',
    cardClassName: 'border-amber-500/35 bg-amber-950/20',
  },
  tripwire: {
    label: 'tripwire',
    icon: ShieldAlert,
    iconClassName: 'text-orange-400',
    cardClassName: 'border-orange-500/35 bg-orange-950/20',
  },
};

function WorkflowBadge({ kind }: { kind: WorkflowBadgeKind }) {
  const config = badgeConfig[kind];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className="gap-1.5 bg-background/80 px-1.5 text-[10px] tracking-normal text-foreground">
      <Icon className="size-3 text-current" style={{ color: config.color }} />
      {config.label}
    </Badge>
  );
}

function ConditionBadge({ type }: { type: WorkflowConditionType }) {
  const config = conditionConfig[type];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className="gap-1.5 bg-background/80 px-1.5 text-[10px] tracking-normal text-foreground">
      <Icon className="size-3 text-current" style={{ color: config.color }} />
      {config.label}
    </Badge>
  );
}

function StatusIcon({ status = 'idle' }: { status?: WorkflowStepStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return <Icon className={cn('size-4 shrink-0', config.iconClassName)} aria-label={config.label} />;
}

function getCardClassName(status?: WorkflowStepStatus, className?: string) {
  const config = statusConfig[status ?? 'idle'];

  return cn('w-[274px] overflow-hidden rounded-lg border text-card-foreground shadow-sm', config.cardClassName, className);
}

function NodeHandles({ withoutTopHandle, withoutBottomHandle }: Pick<WorkflowBaseNodeData, 'withoutTopHandle' | 'withoutBottomHandle'>) {
  return (
    <>
      {!withoutTopHandle && <Handle type="target" position={Position.Top} style={hiddenHandleStyle} />}
      {!withoutBottomHandle && <Handle type="source" position={Position.Bottom} style={hiddenHandleStyle} />}
    </>
  );
}

function BadgeRow({ badges }: { badges?: WorkflowBadgeKind[] }) {
  if (!badges?.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-border/60 bg-muted/20 px-3 py-2">
      {badges.map((badge) => (
        <WorkflowBadge key={badge} kind={badge} />
      ))}
    </div>
  );
}

function NodeHeader({ data }: { data: WorkflowBaseNodeData & { stepId?: string } }) {
  return (
    <div className={cn('flex items-start gap-2 px-3 pt-3', !data.description && 'pb-3')}>
      <StatusIcon status={data.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-5 text-foreground">{data.label}</p>
        {data.stepId && <p className="truncate text-[11px] leading-4 text-muted-foreground">{data.stepId}</p>}
      </div>
    </div>
  );
}

function Description({ children }: { children?: string }) {
  if (!children) {
    return null;
  }

  return <p className="px-3 pb-3 text-xs leading-5 text-muted-foreground">{children}</p>;
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = durationMs / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function DetailRow({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-3 text-xs leading-5 text-muted-foreground">{children}</p>;
}

function ProgressRow({ progress }: { progress?: WorkflowDefaultNodeData['progress'] }) {
  if (!progress) {
    return null;
  }

  const percentage = progress.total > 0 ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : 0;

  return (
    <div className="flex items-center gap-2 px-3 pb-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${percentage}%` }} />
      </div>
      <span className="whitespace-nowrap text-[11px] text-muted-foreground">
        {progress.label ? `${progress.label} ` : ''}
        {progress.completed} / {progress.total}
      </span>
    </div>
  );
}

function WorkflowDefaultNode({ data }: NodeProps<WorkflowDefaultNodeType>) {
  return (
    <>
      <NodeHandles withoutTopHandle={data.withoutTopHandle} withoutBottomHandle={data.withoutBottomHandle} />
      <div data-testid="workflow-default-node" data-workflow-node data-workflow-step-status={data.status ?? 'idle'} className={getCardClassName(data.status)}>
        <BadgeRow badges={data.badges} />
        <NodeHeader data={data} />
        <Description>{data.description}</Description>
        {data.durationMs && (
          <DetailRow>
            sleeps for <strong className="font-medium text-foreground">{formatDuration(data.durationMs)}</strong>
          </DetailRow>
        )}
        {data.date && (
          <DetailRow>
            sleeps until <strong className="font-medium text-foreground">{formatDate(data.date)}</strong>
          </DetailRow>
        )}
        <ProgressRow progress={data.progress} />
        {data.metadata && <p className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">{data.metadata}</p>}
      </div>
    </>
  );
}

function ConditionLine({ condition, index }: { condition: WorkflowCondition; index: number }) {
  const conjunction = index > 0 ? condition.conj ?? 'and' : undefined;

  return (
    <div className="space-y-1.5">
      {conjunction && (
        <Badge variant="outline" className="bg-background/80 px-1.5 text-[10px] uppercase tracking-normal text-muted-foreground">
          {conjunction}
        </Badge>
      )}
      {condition.fnString ? (
        <pre className="max-h-24 overflow-hidden whitespace-pre-wrap rounded-md bg-background/70 p-2 font-mono text-[11px] leading-4 text-muted-foreground">
          {condition.fnString.trim()}
        </pre>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          <span className="text-foreground">{condition.source ?? 'trigger'}</span>
          {condition.path ? `.${condition.path}` : ''} {condition.query ?? 'matches the branch condition'}
        </p>
      )}
    </div>
  );
}

function WorkflowConditionNode({ data }: NodeProps<WorkflowConditionNodeType>) {
  const type = data.conditions[0]?.type ?? 'when';
  const isExpanded = type !== 'else';

  return (
    <>
      <NodeHandles withoutTopHandle={data.withoutTopHandle} withoutBottomHandle={data.withoutBottomHandle} />
      <div data-testid="workflow-condition-node" data-workflow-node data-workflow-step-status={data.status ?? 'idle'} className={getCardClassName(data.status)}>
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <ConditionBadge type={type} />
          {isExpanded && <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
        {isExpanded && (
          <div className="space-y-2 p-3">
            {data.conditions.map((condition, index) => (
              <ConditionLine key={`${condition.type}-${index}`} condition={condition} index={index} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function WorkflowAfterNode({ data }: NodeProps<WorkflowAfterNodeType>) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={hiddenHandleStyle} />
      <div data-testid="workflow-after-node" data-workflow-node data-workflow-step-status="idle" className="w-[274px] overflow-hidden rounded-md border border-border bg-muted/25 p-2 text-card-foreground shadow-sm">
        <div className="flex items-center justify-between pb-2">
          <WorkflowBadge kind="after" />
          <ChevronDown className="size-4 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          {data.steps.map((step) => (
            <div key={step} className="flex items-center gap-2 rounded-sm bg-background/70 p-2 text-xs text-foreground">
              <Footprints className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{step}</span>
            </div>
          ))}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={hiddenHandleStyle} />
    </>
  );
}

function WorkflowLoopResultNode({ data }: NodeProps<WorkflowLoopResultNodeType>) {
  const status: WorkflowStepStatus = data.result ? 'success' : 'failed';

  return (
    <>
      <Handle type="target" position={Position.Top} style={hiddenHandleStyle} />
      <div data-testid="workflow-loop-result-node" data-workflow-node data-workflow-step-status={status} className={getCardClassName(status, 'rounded-md p-2')}>
        <div className="flex items-center gap-2 rounded-sm bg-background/70 p-2 text-sm text-foreground">
          {data.result ? <CheckCircle2 className="size-4 text-emerald-400" /> : <CircleX className="size-4 text-rose-400" />}
          <span className="capitalize">{String(data.result)}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={hiddenHandleStyle} />
    </>
  );
}

function WorkflowNestedNode({ data }: NodeProps<WorkflowNestedNodeType>) {
  const badges = data.badges?.includes('workflow') ? data.badges : ['workflow' as const, ...(data.badges ?? [])];

  return (
    <>
      <NodeHandles withoutTopHandle={data.withoutTopHandle} withoutBottomHandle={data.withoutBottomHandle} />
      <div data-testid="workflow-nested-node" data-workflow-node data-workflow-step-status={data.status ?? 'idle'} className={getCardClassName(data.status)}>
        <BadgeRow badges={badges} />
        <NodeHeader data={data} />
        <Description>{data.description}</Description>
        <div className="space-y-1.5 border-t border-border/60 px-3 py-2">
          {data.nestedSteps.map((step) => (
            <div key={step} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Layers className="size-3 text-violet-400" />
              <span className="truncate">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export const workflowNodeTypes: NodeTypes = {
  'default-node': WorkflowDefaultNode as ComponentType<NodeProps>,
  'condition-node': WorkflowConditionNode as ComponentType<NodeProps>,
  'after-node': WorkflowAfterNode as ComponentType<NodeProps>,
  'loop-result-node': WorkflowLoopResultNode as ComponentType<NodeProps>,
  'nested-node': WorkflowNestedNode as ComponentType<NodeProps>,
};
