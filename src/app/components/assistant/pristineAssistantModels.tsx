import { ModelProviderLogo } from '@/app/components/assistant-ui/model-provider-logo';
import type { ModelProviderOption } from '@/app/components/assistant-ui/model-selector';
import {
  mastraStudioModelCatalog,
  type MastraStudioModelProvider,
} from './mastraStudioModelCatalog.generated';

export const PRISTINE_DEFAULT_MODEL_ID = 'openrouter/openrouter/free';

function getProviderDescription(provider: MastraStudioModelProvider) {
  return `${provider.models.length} Mastra Studio models`;
}

export const pristineModelProviders = mastraStudioModelCatalog.map((provider) => ({
  id: provider.id,
  name: provider.name,
  description: getProviderDescription(provider),
  icon: <ModelProviderLogo providerId={provider.id} providerName={provider.name} />,
  models: provider.models.map((model) => ({
    id: model.id,
    name: model.name,
    description: model.modelId,
  })),
})) satisfies ModelProviderOption[];
