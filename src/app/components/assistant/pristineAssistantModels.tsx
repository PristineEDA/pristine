import { BrainCircuit, Cpu, Zap } from 'lucide-react';

import type { ModelOption } from '@/app/components/assistant-ui/model-selector';

export const PRISTINE_DEFAULT_MODEL_ID = 'pristine-hdl';

export const mockPristineModelOptions = [
  {
    id: 'pristine-fast',
    name: 'Pristine Fast',
    description: 'Quick coding passes',
    icon: <Zap className="size-4" />,
  },
  {
    id: PRISTINE_DEFAULT_MODEL_ID,
    name: 'Pristine HDL',
    description: 'RTL-aware default',
    icon: <Cpu className="size-4" />,
  },
  {
    id: 'pristine-deep',
    name: 'Pristine Deep',
    description: 'Deeper reasoning passes',
    icon: <BrainCircuit className="size-4" />,
  },
] satisfies ModelOption[];
