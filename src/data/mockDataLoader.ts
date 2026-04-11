import { useEffect, useState } from 'react';
import type { AIMessage, OutlineItem, Problem, Reference, StaticCheckItem } from './mockData';

type MockDataModule = typeof import('./mockData');

let mockDataPromise: Promise<MockDataModule> | null = null;
let problemsCache: Problem[] | null = null;
let outlinesCache: Record<string, OutlineItem[]> | null = null;
let aiMessagesCache: AIMessage[] | null = null;
let staticChecksCache: StaticCheckItem[] | null = null;
let referencesCache: Reference[] | null = null;
let outputLogCache: MockDataModule['outputLog'] | null = null;

function scheduleIdleLoad(load: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  if ('requestIdleCallback' in window) {
    const idleCallbackId = window.requestIdleCallback(() => {
      load();
    });

    return () => {
      window.cancelIdleCallback(idleCallbackId);
    };
  }

  const timeoutId = globalThis.setTimeout(() => {
    load();
  }, 120);

  return () => {
    globalThis.clearTimeout(timeoutId);
  };
}

function loadMockDataModule(): Promise<MockDataModule> {
  if (!mockDataPromise) {
    mockDataPromise = import('./mockData');
  }

  return mockDataPromise;
}

export async function loadProblemsList(): Promise<Problem[]> {
  if (problemsCache) {
    return problemsCache;
  }

  const module = await loadMockDataModule();
  problemsCache = module.problemsList;
  return problemsCache;
}

export async function loadFileOutlines(): Promise<Record<string, OutlineItem[]>> {
  if (outlinesCache) {
    return outlinesCache;
  }

  const module = await loadMockDataModule();
  outlinesCache = module.fileOutlines;
  return outlinesCache;
}

export async function loadInitialAIMessages(): Promise<AIMessage[]> {
  if (aiMessagesCache) {
    return aiMessagesCache;
  }

  const module = await loadMockDataModule();
  aiMessagesCache = module.initialAIMessages;
  return aiMessagesCache;
}

export async function loadStaticChecks(): Promise<StaticCheckItem[]> {
  if (staticChecksCache) {
    return staticChecksCache;
  }

  const module = await loadMockDataModule();
  staticChecksCache = module.staticChecks;
  return staticChecksCache;
}

export async function loadReferences(): Promise<Reference[]> {
  if (referencesCache) {
    return referencesCache;
  }

  const module = await loadMockDataModule();
  referencesCache = module.references;
  return referencesCache;
}

export async function loadOutputLog(): Promise<MockDataModule['outputLog']> {
  if (outputLogCache) {
    return outputLogCache;
  }

  const module = await loadMockDataModule();
  outputLogCache = module.outputLog;
  return outputLogCache;
}

export function useProblemsList() {
  const [problems, setProblems] = useState<Problem[]>(() => problemsCache ?? []);

  useEffect(() => {
    if (problemsCache) {
      return;
    }

    let cancelled = false;
    const cancelScheduledLoad = scheduleIdleLoad(() => {
      void loadProblemsList().then((nextProblems) => {
        if (!cancelled) {
          setProblems(nextProblems);
        }
      });
    });

    return () => {
      cancelled = true;
      cancelScheduledLoad();
    };
  }, []);

  return problems;
}

export function useFileOutlines() {
  const [outlines, setOutlines] = useState<Record<string, OutlineItem[]>>(() => outlinesCache ?? {});

  useEffect(() => {
    if (outlinesCache) {
      return;
    }

    let cancelled = false;
    const cancelScheduledLoad = scheduleIdleLoad(() => {
      void loadFileOutlines().then((nextOutlines) => {
        if (!cancelled) {
          setOutlines(nextOutlines);
        }
      });
    });

    return () => {
      cancelled = true;
      cancelScheduledLoad();
    };
  }, []);

  return outlines;
}

export function useInitialAIMessages() {
  const [messages, setMessages] = useState<AIMessage[]>(() => aiMessagesCache ?? []);

  useEffect(() => {
    if (aiMessagesCache) {
      return;
    }

    let cancelled = false;
    const cancelScheduledLoad = scheduleIdleLoad(() => {
      void loadInitialAIMessages().then((nextMessages) => {
        if (!cancelled) {
          setMessages(nextMessages);
        }
      });
    });

    return () => {
      cancelled = true;
      cancelScheduledLoad();
    };
  }, []);

  return messages;
}

export function useStaticChecks() {
  const [staticChecks, setStaticChecks] = useState<StaticCheckItem[]>(() => staticChecksCache ?? []);

  useEffect(() => {
    if (staticChecksCache) {
      return;
    }

    let cancelled = false;
    const cancelScheduledLoad = scheduleIdleLoad(() => {
      void loadStaticChecks().then((nextChecks) => {
        if (!cancelled) {
          setStaticChecks(nextChecks);
        }
      });
    });

    return () => {
      cancelled = true;
      cancelScheduledLoad();
    };
  }, []);

  return staticChecks;
}

export function useReferences() {
  const [references, setReferences] = useState<Reference[]>(() => referencesCache ?? []);

  useEffect(() => {
    if (referencesCache) {
      return;
    }

    let cancelled = false;
    const cancelScheduledLoad = scheduleIdleLoad(() => {
      void loadReferences().then((nextReferences) => {
        if (!cancelled) {
          setReferences(nextReferences);
        }
      });
    });

    return () => {
      cancelled = true;
      cancelScheduledLoad();
    };
  }, []);

  return references;
}

export function useOutputLog() {
  const [outputLog, setOutputLog] = useState<MockDataModule['outputLog']>(() => outputLogCache ?? []);

  useEffect(() => {
    if (outputLogCache) {
      return;
    }

    let cancelled = false;
    const cancelScheduledLoad = scheduleIdleLoad(() => {
      void loadOutputLog().then((nextOutputLog) => {
        if (!cancelled) {
          setOutputLog(nextOutputLog);
        }
      });
    });

    return () => {
      cancelled = true;
      cancelScheduledLoad();
    };
  }, []);

  return outputLog;
}