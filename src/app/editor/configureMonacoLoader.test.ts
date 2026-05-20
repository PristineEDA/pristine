import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class EditorWorkerMock {
    readonly kind = 'editor';
  }

  class CssWorkerMock {
    readonly kind = 'css';
  }

  class HtmlWorkerMock {
    readonly kind = 'html';
  }

  class JsonWorkerMock {
    readonly kind = 'json';
  }

  class TsWorkerMock {
    readonly kind = 'typescript';
  }

  return {
    CssWorkerMock,
    EditorWorkerMock,
    HtmlWorkerMock,
    JsonWorkerMock,
    TsWorkerMock,
    loaderConfig: vi.fn(),
    monacoModule: {
      editor: {},
    },
  };
});

vi.mock('@monaco-editor/react', () => ({
  loader: {
    config: mocks.loaderConfig,
  },
}));

vi.mock('monaco-editor', () => mocks.monacoModule);
vi.mock('monaco-editor/esm/vs/editor/editor.worker?worker', () => ({ default: mocks.EditorWorkerMock }));
vi.mock('monaco-editor/esm/vs/language/css/css.worker?worker', () => ({ default: mocks.CssWorkerMock }));
vi.mock('monaco-editor/esm/vs/language/html/html.worker?worker', () => ({ default: mocks.HtmlWorkerMock }));
vi.mock('monaco-editor/esm/vs/language/json/json.worker?worker', () => ({ default: mocks.JsonWorkerMock }));
vi.mock('monaco-editor/esm/vs/language/typescript/ts.worker?worker', () => ({ default: mocks.TsWorkerMock }));

const marker = '__pristineMonacoLoaderConfigured';

function resetMonacoGlobal() {
  delete (globalThis as typeof globalThis & { MonacoEnvironment?: unknown }).MonacoEnvironment;
  delete (globalThis as typeof globalThis & Record<string, unknown>)[marker];
}

describe('configureMonacoLoader', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.loaderConfig.mockClear();
    resetMonacoGlobal();
  });

  it('configures Monaco once at module load and maps editor language workers by label', async () => {
    await import('./configureMonacoLoader');

    expect(mocks.loaderConfig).toHaveBeenCalledTimes(1);
    expect(mocks.loaderConfig).toHaveBeenCalledWith({ monaco: mocks.monacoModule });

    const getWorker = (globalThis as typeof globalThis & {
      MonacoEnvironment: { getWorker: (_moduleId: string, label: string) => Worker };
    }).MonacoEnvironment.getWorker;

    expect(getWorker('', 'json')).toBeInstanceOf(mocks.JsonWorkerMock);
    expect(getWorker('', 'scss')).toBeInstanceOf(mocks.CssWorkerMock);
    expect(getWorker('', 'handlebars')).toBeInstanceOf(mocks.HtmlWorkerMock);
    expect(getWorker('', 'javascript')).toBeInstanceOf(mocks.TsWorkerMock);
    expect(getWorker('', 'systemverilog')).toBeInstanceOf(mocks.EditorWorkerMock);
  });

  it('keeps explicit configure calls idempotent after the first setup', async () => {
    const { configureMonacoLoader } = await import('./configureMonacoLoader');
    mocks.loaderConfig.mockClear();

    configureMonacoLoader();

    expect(mocks.loaderConfig).not.toHaveBeenCalled();
  });
});