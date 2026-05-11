import { StoreExtensionManager } from '@blocksuite/affine/ext-loader';
import { getInternalStoreExtensions } from '@blocksuite/affine/extensions/store';
import { FeatureFlagService } from '@blocksuite/affine/shared/services';
import { createDefaultDoc } from '@blocksuite/affine/shared/utils';
import type { Store } from '@blocksuite/affine/store';
import { TestWorkspace } from '@blocksuite/affine/store/test';

export interface WhiteboardStoreHandle {
  store: Store;
  workspace: TestWorkspace;
  dispose: () => void;
}

export function createWhiteboardStore(): WhiteboardStoreHandle {
  const workspace = new TestWorkspace({ id: 'pristine-whiteboard' });
  const storeManager = new StoreExtensionManager(getInternalStoreExtensions());
  workspace.storeExtensions = storeManager.get('store');

  workspace.meta.initialize();
  const store = createDefaultDoc(workspace, {
    id: 'pristine-whiteboard-doc',
    title: 'Whiteboard',
  });
  const featureFlags = store.get(FeatureFlagService);
  featureFlags.setFlag('enable_edgeless_text', true);
  featureFlags.setFlag('enable_color_picker', true);

  return {
    store,
    workspace,
    dispose: () => {
      store.dispose();
      workspace.dispose();
    },
  };
}
