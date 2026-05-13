import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadDeferredMainContentViews } from './mainContentViewPreload';

describe('mainContentViewPreload', () => {
  let idleCallbacks: Map<number, () => void>;
  let nextIdleCallbackId: number;
  let originalRequestIdleCallback: Window['requestIdleCallback'] | undefined;
  let originalCancelIdleCallback: Window['cancelIdleCallback'] | undefined;

  beforeEach(() => {
    idleCallbacks = new Map();
    nextIdleCallbackId = 1;
    originalRequestIdleCallback = window.requestIdleCallback;
    originalCancelIdleCallback = window.cancelIdleCallback;
  });

  afterEach(() => {
    vi.useRealTimers();

    if (originalRequestIdleCallback) {
      Object.defineProperty(window, 'requestIdleCallback', {
        configurable: true,
        writable: true,
        value: originalRequestIdleCallback,
      });
    } else {
      Reflect.deleteProperty(window, 'requestIdleCallback');
    }

    if (originalCancelIdleCallback) {
      Object.defineProperty(window, 'cancelIdleCallback', {
        configurable: true,
        writable: true,
        value: originalCancelIdleCallback,
      });
    } else {
      Reflect.deleteProperty(window, 'cancelIdleCallback');
    }
  });

  function installIdleCallbackMocks() {
    const requestIdleCallbackMock = vi.fn((callback: Parameters<Window['requestIdleCallback']>[0]) => {
      const callbackId = nextIdleCallbackId;
      nextIdleCallbackId += 1;
      idleCallbacks.set(callbackId, () => {
        callback({
          didTimeout: false,
          timeRemaining: () => 50,
        });
      });

      return callbackId;
    });
    const cancelIdleCallbackMock = vi.fn((callbackId: number) => {
      idleCallbacks.delete(callbackId);
    });

    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      writable: true,
      value: requestIdleCallbackMock,
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      writable: true,
      value: cancelIdleCallbackMock,
    });

    return {
      cancelIdleCallbackMock,
      requestIdleCallbackMock,
    };
  }

  function runIdleCallback(callbackId: number) {
    const callback = idleCallbacks.get(callbackId);

    if (!callback) {
      throw new Error(`Expected idle callback ${callbackId} to be scheduled`);
    }

    idleCallbacks.delete(callbackId);
    callback();
  }

  it('preloads workflow first and whiteboard in the next idle slot', () => {
    const { requestIdleCallbackMock } = installIdleCallbackMocks();
    const loadWorkflowView = vi.fn(() => Promise.resolve());
    const loadWhiteboardView = vi.fn(() => Promise.resolve());
    const requestWorkflowMount = vi.fn();
    const requestWhiteboardMount = vi.fn();

    preloadDeferredMainContentViews({
      loadWorkflowView,
      loadWhiteboardView,
      requestWorkflowMount,
      requestWhiteboardMount,
    });

    expect(requestIdleCallbackMock).toHaveBeenCalledTimes(1);
    expect(requestIdleCallbackMock).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 });
    expect(loadWorkflowView).not.toHaveBeenCalled();
    expect(loadWhiteboardView).not.toHaveBeenCalled();
    expect(requestWorkflowMount).not.toHaveBeenCalled();
    expect(requestWhiteboardMount).not.toHaveBeenCalled();

    runIdleCallback(1);

    expect(loadWorkflowView).toHaveBeenCalledTimes(1);
    expect(requestWorkflowMount).toHaveBeenCalledTimes(1);
    expect(loadWhiteboardView).not.toHaveBeenCalled();
    expect(requestWhiteboardMount).not.toHaveBeenCalled();
    expect(requestIdleCallbackMock).toHaveBeenCalledTimes(2);

    runIdleCallback(2);

    expect(loadWhiteboardView).toHaveBeenCalledTimes(1);
    expect(requestWhiteboardMount).toHaveBeenCalledTimes(1);
  });

  it('cancels the next pending idle preload during cleanup', () => {
    const { cancelIdleCallbackMock } = installIdleCallbackMocks();
    const loadWorkflowView = vi.fn(() => Promise.resolve());
    const loadWhiteboardView = vi.fn(() => Promise.resolve());
    const requestWorkflowMount = vi.fn();
    const requestWhiteboardMount = vi.fn();

    const cleanup = preloadDeferredMainContentViews({
      loadWorkflowView,
      loadWhiteboardView,
      requestWorkflowMount,
      requestWhiteboardMount,
    });

    cleanup();

    expect(cancelIdleCallbackMock).toHaveBeenCalledWith(1);
    expect(idleCallbacks.has(1)).toBe(false);
    expect(loadWorkflowView).not.toHaveBeenCalled();
    expect(loadWhiteboardView).not.toHaveBeenCalled();
    expect(requestWorkflowMount).not.toHaveBeenCalled();
    expect(requestWhiteboardMount).not.toHaveBeenCalled();

    const cleanupAfterWorkflow = preloadDeferredMainContentViews({
      loadWorkflowView,
      loadWhiteboardView,
      requestWorkflowMount,
      requestWhiteboardMount,
    });

    runIdleCallback(2);
    cleanupAfterWorkflow();

    expect(loadWorkflowView).toHaveBeenCalledTimes(1);
    expect(requestWorkflowMount).toHaveBeenCalledTimes(1);
    expect(cancelIdleCallbackMock).toHaveBeenCalledWith(3);
    expect(idleCallbacks.has(3)).toBe(false);
    expect(loadWhiteboardView).not.toHaveBeenCalled();
    expect(requestWhiteboardMount).not.toHaveBeenCalled();
  });

  it('falls back to a 2000ms timeout when requestIdleCallback is unavailable', () => {
    vi.useFakeTimers();
    Reflect.deleteProperty(window, 'requestIdleCallback');
    Reflect.deleteProperty(window, 'cancelIdleCallback');

    const loadWorkflowView = vi.fn(() => Promise.resolve());
    const loadWhiteboardView = vi.fn(() => Promise.resolve());
    const requestWorkflowMount = vi.fn();
    const requestWhiteboardMount = vi.fn();

    preloadDeferredMainContentViews({
      loadWorkflowView,
      loadWhiteboardView,
      requestWorkflowMount,
      requestWhiteboardMount,
    });

    vi.advanceTimersByTime(1999);

    expect(loadWorkflowView).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(loadWorkflowView).toHaveBeenCalledTimes(1);
    expect(requestWorkflowMount).toHaveBeenCalledTimes(1);
    expect(loadWhiteboardView).not.toHaveBeenCalled();
    expect(requestWhiteboardMount).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);

    expect(loadWhiteboardView).toHaveBeenCalledTimes(1);
    expect(requestWhiteboardMount).toHaveBeenCalledTimes(1);
  });
});
