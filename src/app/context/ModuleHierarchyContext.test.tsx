import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ModuleHierarchyProvider,
  useModuleHierarchy,
  type ModuleHierarchyTop,
} from './ModuleHierarchyContext';
import { resetModuleHierarchyStoreForTests } from './useModuleHierarchyStore';

const manualTop: ModuleHierarchyTop = {
  filePath: 'rtl/core/cpu_top.sv',
  kind: 'manual',
  moduleName: 'cpu_top',
  rootKey: 'manual:cpu_top',
};

function ModuleHierarchyHarness() {
  const { top, setTop } = useModuleHierarchy();

  return (
    <div>
      <span data-testid="hierarchy-top">{top?.moduleName ?? 'none'}</span>
      <button type="button" onClick={() => setTop(manualTop)}>set-top</button>
      <button type="button" onClick={() => setTop(null)}>clear-top</button>
    </div>
  );
}

describe('ModuleHierarchyContext', () => {
  beforeEach(() => {
    resetModuleHierarchyStoreForTests();
  });

  it('keeps the provider facade compatible while backing state with the store', async () => {
    const user = userEvent.setup();
    render(
      <ModuleHierarchyProvider>
        <ModuleHierarchyHarness />
      </ModuleHierarchyProvider>,
    );

    expect(screen.getByTestId('hierarchy-top')).toHaveTextContent('none');

    await user.click(screen.getByRole('button', { name: 'set-top' }));
    expect(screen.getByTestId('hierarchy-top')).toHaveTextContent('cpu_top');

    await user.click(screen.getByRole('button', { name: 'clear-top' }));
    expect(screen.getByTestId('hierarchy-top')).toHaveTextContent('none');
  });
});
