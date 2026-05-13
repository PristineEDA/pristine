type DeferredMainContentViewLoaders = {
  loadWorkflowView: () => Promise<unknown>;
  loadWhiteboardView: () => Promise<unknown>;
};

type DeferredMainContentViewMountRequests = {
  requestWorkflowMount: () => void;
  requestWhiteboardMount: () => void;
};

type CancelScheduledPreload = () => void;

const DEFERRED_VIEW_PRELOAD_TIMEOUT_MS = 2000;

export function loadWorkflowView() {
  return import('./components/workflow/WorkflowView');
}

export function loadWhiteboardView() {
  return import('./components/whiteboard/WhiteboardView');
}

function scheduleDeferredMainContentViewPreload(callback: () => void): CancelScheduledPreload {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let isPending = true;
  const runCallback = () => {
    if (!isPending) {
      return;
    }

    isPending = false;
    callback();
  };

  if ('requestIdleCallback' in window) {
    const idleCallbackId = window.requestIdleCallback(runCallback, {
      timeout: DEFERRED_VIEW_PRELOAD_TIMEOUT_MS,
    });

    return () => {
      if (!isPending) {
        return;
      }

      isPending = false;
      window.cancelIdleCallback(idleCallbackId);
    };
  }

  const timeoutId = globalThis.setTimeout(runCallback, DEFERRED_VIEW_PRELOAD_TIMEOUT_MS);

  return () => {
    if (!isPending) {
      return;
    }

    isPending = false;
    globalThis.clearTimeout(timeoutId);
  };
}

export function preloadDeferredMainContentViews(
  options: Partial<DeferredMainContentViewLoaders & DeferredMainContentViewMountRequests> = {},
): CancelScheduledPreload {
  const workflowLoader = options.loadWorkflowView ?? loadWorkflowView;
  const whiteboardLoader = options.loadWhiteboardView ?? loadWhiteboardView;
  const requestWorkflowMount = options.requestWorkflowMount ?? (() => {});
  const requestWhiteboardMount = options.requestWhiteboardMount ?? (() => {});

  let cancelScheduledPreload = scheduleDeferredMainContentViewPreload(() => {
    void workflowLoader();
    requestWorkflowMount();

    cancelScheduledPreload = scheduleDeferredMainContentViewPreload(() => {
      void whiteboardLoader();
      requestWhiteboardMount();
    });
  });

  return () => {
    cancelScheduledPreload();
  };
}
