import {
  Check,
  Code2,
  FileCode2,
  FileText,
  Image,
  Lightbulb,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type AssistantAgentMode = 'agent' | 'ask' | 'plan';

export interface AssistantQuickAction {
  label: string;
  icon: LucideIcon;
}

export interface AssistantAgentOption {
  id: AssistantAgentMode;
  label: string;
  desc: string;
}

export interface AssistantModelOption {
  id: string;
  label: string;
  tokens: string;
}

export interface AssistantAttachOption {
  icon: LucideIcon;
  label: string;
  desc: string;
}

export const DEFAULT_MODEL = 'Claude Opus 4.6';

export const DEFAULT_SIMULATED_RESPONSE = 'I understand your question. Based on the current RTL code context, I recommend checking the signal drive logic and timing constraints. Would you like me to generate a specific code example?';

export const QUICK_ACTIONS: AssistantQuickAction[] = [
  { label: 'Explain', icon: Lightbulb },
  { label: 'Optimize', icon: Zap },
  { label: 'Test', icon: Code2 },
  { label: 'Fix', icon: Wrench },
];

export const AGENT_OPTIONS: AssistantAgentOption[] = [
  { id: 'agent', label: 'Agent', desc: 'autonomous multi-step tasks' },
  { id: 'ask', label: 'Ask', desc: 'answer questions' },
  { id: 'plan', label: 'Plan', desc: 'execuate multi-step plans' },
];

export const MODEL_OPTIONS: AssistantModelOption[] = [
  { id: 'Claude Opus 4.6', label: 'Claude Opus 4.6', tokens: '200k' },
  { id: 'Claude Sonnet 4.6', label: 'Claude Sonnet 4.6', tokens: '200k' },
  { id: 'GPT-5.4', label: 'GPT-5.4', tokens: '128k' },
  { id: 'Gemini 3 Pro', label: 'Gemini 3 Pro', tokens: '1M' },
];

export const ATTACH_OPTIONS: AssistantAttachOption[] = [
  { icon: FileCode2, label: 'Add File', desc: 'Attach a source file' },
  { icon: Image, label: 'Add Image', desc: 'Attach a screenshot or diagram' },
  { icon: FileText, label: 'Add Context', desc: 'Add selection or symbol' },
];

export const AGENT_COLORS: Record<AssistantAgentMode, string> = {
  agent: '#c586c0',
  ask: '#4ec9b0',
  plan: '#dcdcaa',
};

export function getTokenLimitForModel(selectedModel: string): number {
  if (selectedModel === 'Gemini 1.5 Pro' || selectedModel === 'Gemini 3 Pro') {
    return 1_000_000;
  }

  if (selectedModel.includes('Claude')) {
    return 200_000;
  }

  return 128_000;
}

export { Check };