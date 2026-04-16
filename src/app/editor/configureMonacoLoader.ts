import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

const MONACO_LOADER_MARKER = '__pristineMonacoLoaderConfigured' as const;

type MonacoWorkerFactory = new () => Worker;

type MonacoGlobalScope = typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: (_moduleId: string, label: string) => Worker;
  };
  [MONACO_LOADER_MARKER]?: boolean;
};

function createWorker(workerFactory: MonacoWorkerFactory): Worker {
  return new workerFactory();
}

export function configureMonacoLoader(): void {
  const monacoGlobal = globalThis as MonacoGlobalScope;

  if (monacoGlobal[MONACO_LOADER_MARKER]) {
    return;
  }

  monacoGlobal.MonacoEnvironment = {
    getWorker(_moduleId, label) {
      if (label === 'json') {
        return createWorker(jsonWorker);
      }

      if (label === 'css' || label === 'scss' || label === 'less') {
        return createWorker(cssWorker);
      }

      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return createWorker(htmlWorker);
      }

      if (label === 'typescript' || label === 'javascript') {
        return createWorker(tsWorker);
      }

      return createWorker(editorWorker);
    },
  };

  loader.config({ monaco });
  monacoGlobal[MONACO_LOADER_MARKER] = true;
}

configureMonacoLoader();