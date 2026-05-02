import {
  Bot,
  BrainCircuit,
  Cloud,
  Cpu,
  Globe2,
  Network,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import type { ModelProviderOption } from '@/app/components/assistant-ui/model-selector';
import {
  mastraStudioModelCatalog,
  type MastraStudioModelProvider,
} from './mastraStudioModelCatalog.generated';

export const PRISTINE_DEFAULT_MODEL_ID = 'openrouter/openrouter/free';

const providerIconMap: Record<string, LucideIcon> = {
  amazon: Cloud,
  anthropic: BrainCircuit,
  azure: Cloud,
  cohere: Bot,
  deepseek: Cpu,
  google: Globe2,
  groq: Zap,
  mastra: Sparkles,
  mistral: Sparkles,
  openai: Sparkles,
  openrouter: Network,
  xai: Bot,
};

function getProviderIcon(providerId: string) {
  const Icon = providerIconMap[providerId] ?? Bot;
  return <Icon className="size-4" />;
}

function getProviderDescription(provider: MastraStudioModelProvider) {
  return `${provider.models.length} Mastra Studio models`;
}

export const pristineModelProviders = mastraStudioModelCatalog.map((provider) => ({
  id: provider.id,
  name: provider.name,
  description: getProviderDescription(provider),
  icon: getProviderIcon(provider.id),
  models: provider.models.map((model) => ({
    id: model.id,
    name: model.name,
    description: model.modelId,
  })),
})) satisfies ModelProviderOption[];
