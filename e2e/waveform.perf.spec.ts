import { test, expect, _electron as electron, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureWorkspace = path.join(__dirname, '..', 'test', 'fixtures', 'workspace');
const UI_READY_TIMEOUT_MS = 60000;

interface StartupWindowEntry {
  page: Page;
  title: string | null;
  url: string;
}

function getE2EUserDataPath() {
  return test.info().outputPath('electron-user-data');
}

async function getPageTitleSafely(page: Page) {
  if (page.isClosed()) {
    return null;
  }

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    return await page.title();
  } catch {
    return null;
  }
}

function isMainWindow(entry: Pick<StartupWindowEntry, 'title' | 'url'>) {
  return entry.title === 'Pristine' || entry.url.endsWith('/index.html');
}

async function getIdentifiedWindows(app: Awaited<ReturnType<typeof electron.launch>>) {
  return Promise.all(
    app.windows().map(async (page) => ({
      page,
      title: await getPageTitleSafely(page),
      url: page.url(),
    })),
  );
}

async function waitForMainUi(window: Page) {
  await window.waitForLoadState('domcontentloaded', { timeout: UI_READY_TIMEOUT_MS });
  await expect(window.getByTestId('toggle-activity-bar')).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
}

async function resolveMainWindow(app: Awaited<ReturnType<typeof electron.launch>>) {
  await expect.poll(async () => {
    const identifiedWindows = await getIdentifiedWindows(app);

    return identifiedWindows.some(isMainWindow);
  }, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe(true);

  const resolvedWindow = (await getIdentifiedWindows(app)).find(isMainWindow)?.page ?? null;

  if (!resolvedWindow) {
    throw new Error('Expected Pristine main window during startup.');
  }

  await waitForMainUi(resolvedWindow);
  return resolvedWindow;
}

async function launchApp() {
  const app = await electron.launch({
    args: [path.join(__dirname, '..', 'dist-electron', 'main.js')],
    env: {
      ...process.env,
      PRISTINE_E2E: '1',
      PRISTINE_PROJECT_ROOT: fixtureWorkspace,
      PRISTINE_USER_DATA_PATH: getE2EUserDataPath(),
    },
  });

  const window = await resolveMainWindow(app);

  return { app, window };
}

async function openWaveformPanel(window: Page) {
  const toggleBottomPanel = window.getByTestId('toggle-bottom-panel');
  await expect(toggleBottomPanel).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  if ((await toggleBottomPanel.getAttribute('aria-pressed')) !== 'true') {
    await toggleBottomPanel.click();
  }

  const bottomPanel = window.getByTestId('panel-bottom-panel');
  await expect(bottomPanel).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  const waveformTab = bottomPanel.getByTestId('bottom-panel-tab-waveform');
  await expect(waveformTab).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await waveformTab.click();

  const panel = window.getByTestId('waveform-panel');
  await expect(panel).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(panel).toHaveAttribute('data-ready', 'true', { timeout: UI_READY_TIMEOUT_MS });

  return panel;
}

async function readCanvasStats(canvasHost: ReturnType<Page['getByTestId']>) {
  const readNumber = async (attribute: string) => Number(await canvasHost.getAttribute(attribute) ?? '0');

  return {
    cacheHitCount: await readNumber('data-cache-hit-count'),
    cacheMissCount: await readNumber('data-cache-miss-count'),
    cacheableSignalCount: await readNumber('data-cacheable-signal-count'),
    cachedSignalCount: await readNumber('data-cached-signal-count'),
    coalescedSegmentCount: await readNumber('data-coalesced-segment-count'),
    compactSignalCount: await readNumber('data-compact-signal-count'),
    culledRowCount: await readNumber('data-culled-row-count'),
    denseColumnCount: await readNumber('data-dense-column-count'),
    denseRunCount: await readNumber('data-dense-run-count'),
    denseSignalCount: await readNumber('data-dense-signal-count'),
    detailSignalCount: await readNumber('data-detail-signal-count'),
    renderResolution: await readNumber('data-render-resolution'),
    renderedSegmentCount: await readNumber('data-rendered-segment-count'),
    renderedSignalCount: await readNumber('data-rendered-signal-count'),
    sourceSegmentCount: await readNumber('data-source-segment-count'),
    suppressedLabelCount: await readNumber('data-suppressed-label-count'),
    textureCacheBytes: await readNumber('data-texture-cache-bytes'),
    textureCacheSize: await readNumber('data-texture-cache-size'),
    visibleRowCount: await readNumber('data-visible-row-count'),
  };
}

test('waveform dense render opt-in baseline', async () => {
  const { app, window } = await launchApp();

  try {
    await openWaveformPanel(window);

    const canvasHost = window.getByTestId('waveform-canvas');
    const panel = window.getByTestId('waveform-panel');
    await expect(canvasHost).toHaveAttribute('data-renderer', /^(webgpu|webgl)$/);
    await expect(canvasHost).toHaveAttribute('data-row-count', '171');
    await expect.poll(async () => Number(await canvasHost.getAttribute('data-render-count') ?? '0'), {
      timeout: UI_READY_TIMEOUT_MS,
    }).toBeGreaterThan(0);

    const measureRender = async (label: string, action: () => Promise<void>) => {
      const beforeRenderCount = Number(await canvasHost.getAttribute('data-render-count') ?? '0');
      const startedAt = Date.now();

      await action();
      await expect.poll(async () => Number(await canvasHost.getAttribute('data-render-count') ?? '0'), {
        timeout: UI_READY_TIMEOUT_MS,
      }).toBeGreaterThan(beforeRenderCount);

      return { label, elapsedMs: Date.now() - startedAt };
    };

    const timings = [
      await measureRender('zoom-in', async () => {
        await window.getByTestId('waveform-zoom-in').click();
      }),
      await measureRender('vertical-scroll', async () => {
        await canvasHost.hover();
        await window.mouse.wheel(0, 420);
      }),
      await measureRender('fit', async () => {
        await window.getByTestId('waveform-fit').click();
      }),
    ];
    const stats = await readCanvasStats(canvasHost);

    expect(stats.sourceSegmentCount).toBeGreaterThan(0);
    expect(stats.renderedSegmentCount).toBeGreaterThan(0);
    expect(stats.denseSignalCount).toBeGreaterThan(0);
    expect(stats.denseRunCount).toBeGreaterThan(0);
    expect(stats.suppressedLabelCount).toBeGreaterThan(0);
    expect(stats.culledRowCount).toBeGreaterThan(0);
    expect(stats.renderResolution).toBeGreaterThanOrEqual(1);
    expect(stats.textureCacheBytes).toBeLessThanOrEqual(32 * 1024 * 1024);

    console.log(JSON.stringify({
      name: 'waveform-dense-render-baseline',
      zoom: Number(await panel.getAttribute('data-zoom') ?? '0'),
      timings,
      stats,
    }, null, 2));
  } finally {
    await app.close();
  }
});
