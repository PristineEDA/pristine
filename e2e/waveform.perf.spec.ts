import { test, expect, _electron as electron, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureWorkspace = path.join(__dirname, '..', 'test', 'fixtures', 'workspace');
const releaseRoot = path.join(__dirname, '..', 'release');
const UI_READY_TIMEOUT_MS = 60000;

interface StartupWindowEntry {
  page: Page;
  title: string | null;
  url: string;
}

function getE2EUserDataPath() {
  return test.info().outputPath('electron-user-data');
}

function findPackagedWindowsExecutablePath() {
  if (process.platform !== 'win32' || !fs.existsSync(releaseRoot)) {
    return null;
  }

  const releaseVersions = fs
    .readdirSync(releaseRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

  for (const version of releaseVersions) {
    const candidatePath = path.join(releaseRoot, version, 'win-unpacked', 'Pristine.exe');

    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

const packagedWindowsExecutablePath = findPackagedWindowsExecutablePath();

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

async function launchPackagedWindowsApp() {
  if (!packagedWindowsExecutablePath) {
    throw new Error('Packaged Windows executable not found');
  }

  const app = await electron.launch({
    executablePath: packagedWindowsExecutablePath,
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
    fullSceneRebuildCount: await readNumber('data-full-scene-rebuild-count'),
    panBufferHitCount: await readNumber('data-pan-buffer-hit-count'),
    panBufferMissCount: await readNumber('data-pan-buffer-miss-count'),
    panPixelShiftCount: await readNumber('data-pan-pixel-shift-count'),
    rowAttachCount: await readNumber('data-row-attach-count'),
    rowContentRedrawCount: await readNumber('data-row-content-redraw-count'),
    rowContentSkipCount: await readNumber('data-row-content-skip-count'),
    rowRecycleCount: await readNumber('data-row-recycle-count'),
    rowReuseCount: await readNumber('data-row-reuse-count'),
    renderResolution: await readNumber('data-render-resolution'),
    renderedSegmentCount: await readNumber('data-rendered-segment-count'),
    renderedSignalCount: await readNumber('data-rendered-signal-count'),
    sourceSegmentCount: await readNumber('data-source-segment-count'),
    suppressedLabelCount: await readNumber('data-suppressed-label-count'),
    textureCacheBytes: await readNumber('data-texture-cache-bytes'),
    textureCacheSize: await readNumber('data-texture-cache-size'),
    cursorUpdateCount: await readNumber('data-cursor-update-count'),
    selectionUpdateCount: await readNumber('data-selection-update-count'),
    visibleRowCount: await readNumber('data-visible-row-count'),
    verticalScrollUpdateCount: await readNumber('data-vertical-scroll-update-count'),
    viewportContentUpdateCount: await readNumber('data-viewport-content-update-count'),
  };
}

async function readPanelMetrics(panel: ReturnType<Page['getByTestId']>) {
  const readNumber = async (attribute: string) => Number(await panel.getAttribute(attribute) ?? '0');

  return {
    averageFps: await readNumber('data-average-fps'),
    averageRenderMs: await readNumber('data-average-render-ms'),
    lastFps: await readNumber('data-last-fps'),
    lastRenderMs: await readNumber('data-last-render-ms'),
    visiblePrimitiveCount: await readNumber('data-visible-primitive-count'),
    browserWebgl2: await panel.getAttribute('data-browser-webgl2'),
    browserWebgpu: await panel.getAttribute('data-browser-webgpu'),
    gpuFeatureWebgl: await panel.getAttribute('data-gpu-feature-webgl'),
    gpuFeatureWebgpu: await panel.getAttribute('data-gpu-feature-webgpu'),
    gpuHardwareAcceleration: await panel.getAttribute('data-gpu-hardware-acceleration'),
  };
}

async function readJsHeapBytes(window: Page) {
  return window.evaluate(() => {
    const performanceWithMemory = performance as Performance & {
      memory?: {
        usedJSHeapSize?: number;
      };
    };

    return performanceWithMemory.memory?.usedJSHeapSize ?? 0;
  });
}

async function waitForNextRender(canvasHost: ReturnType<Page['getByTestId']>, action: () => Promise<void>) {
  const beforeRenderCount = Number(await canvasHost.getAttribute('data-render-count') ?? '0');

  await action();

  await expect.poll(async () => Number(await canvasHost.getAttribute('data-render-count') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(beforeRenderCount);
}

async function capturePerfSample(
  window: Page,
  panel: ReturnType<Page['getByTestId']>,
  canvasHost: ReturnType<Page['getByTestId']>,
  phase: string,
  elapsedMs: number,
) {
  const [canvasStats, panelMetrics, jsHeapBytes] = await Promise.all([
    readCanvasStats(canvasHost),
    readPanelMetrics(panel),
    readJsHeapBytes(window),
  ]);

  return {
    phase,
    elapsedMs,
    renderCount: Number(await canvasHost.getAttribute('data-render-count') ?? '0'),
    canvasStats,
    panelMetrics,
    jsHeapBytes,
  };
}

function diffInteractionMetrics(
  start: Awaited<ReturnType<typeof readCanvasStats>>,
  end: Awaited<ReturnType<typeof readCanvasStats>>,
) {
  return {
    fullSceneRebuildCount: end.fullSceneRebuildCount - start.fullSceneRebuildCount,
    panBufferHitCount: end.panBufferHitCount - start.panBufferHitCount,
    panBufferMissCount: end.panBufferMissCount - start.panBufferMissCount,
    panPixelShiftCount: end.panPixelShiftCount - start.panPixelShiftCount,
    rowAttachCount: end.rowAttachCount - start.rowAttachCount,
    rowContentRedrawCount: end.rowContentRedrawCount - start.rowContentRedrawCount,
    rowContentSkipCount: end.rowContentSkipCount - start.rowContentSkipCount,
    rowRecycleCount: end.rowRecycleCount - start.rowRecycleCount,
    rowReuseCount: end.rowReuseCount - start.rowReuseCount,
    cursorUpdateCount: end.cursorUpdateCount - start.cursorUpdateCount,
    selectionUpdateCount: end.selectionUpdateCount - start.selectionUpdateCount,
    verticalScrollUpdateCount: end.verticalScrollUpdateCount - start.verticalScrollUpdateCount,
    viewportContentUpdateCount: end.viewportContentUpdateCount - start.viewportContentUpdateCount,
  };
}

test('waveform dense render opt-in baseline', async () => {
  const { app, window } = await launchApp();

  try {
    await openWaveformPanel(window);

    const canvasHost = window.getByTestId('waveform-canvas');
    const panel = window.getByTestId('waveform-panel');
    const panRightButton = window.getByRole('button', { name: /pan waveform right/i });
    const panLeftButton = window.getByRole('button', { name: /pan waveform left/i });
    const zoomInButton = window.getByTestId('waveform-zoom-in');
    const zoomOutButton = window.getByTestId('waveform-zoom-out');
    await expect(canvasHost).toHaveAttribute('data-renderer', /^(webgpu|webgl)$/);
    await expect(canvasHost).toHaveAttribute('data-row-count', '171');
    await expect.poll(async () => Number(await canvasHost.getAttribute('data-render-count') ?? '0'), {
      timeout: UI_READY_TIMEOUT_MS,
    }).toBeGreaterThan(0);
    await expect.poll(async () => Number(await panel.getAttribute('data-last-render-ms') ?? '0'), {
      timeout: UI_READY_TIMEOUT_MS,
    }).toBeGreaterThan(0);
    await expect.poll(async () => Number(await panel.getAttribute('data-visible-primitive-count') ?? '0'), {
      timeout: UI_READY_TIMEOUT_MS,
    }).toBeGreaterThan(0);
    await waitForNextRender(canvasHost, async () => {
      await canvasHost.hover();
      await window.mouse.wheel(0, 3600);
    });
    await expect.poll(async () => Number(await canvasHost.getAttribute('data-dense-signal-count') ?? '0'), {
      timeout: UI_READY_TIMEOUT_MS,
    }).toBeGreaterThan(0);
    await expect.poll(async () => Number(await canvasHost.getAttribute('data-dense-run-count') ?? '0'), {
      timeout: UI_READY_TIMEOUT_MS,
    }).toBeGreaterThan(0);
    const denseStats = await readCanvasStats(canvasHost);

    const measureRender = async (label: string, action: () => Promise<void>) => {
      const beforeRenderCount = Number(await canvasHost.getAttribute('data-render-count') ?? '0');
      const startedAt = Date.now();

      await action();
      await expect.poll(async () => Number(await canvasHost.getAttribute('data-render-count') ?? '0'), {
        timeout: UI_READY_TIMEOUT_MS,
      }).toBeGreaterThan(beforeRenderCount);

      return { label, elapsedMs: Date.now() - startedAt };
    };

    const initialPanelMetrics = await readPanelMetrics(panel);
    const jsHeapBeforeBurst = await readJsHeapBytes(window);

    const timings = [
      await measureRender('zoom-in', async () => {
        await zoomInButton.click();
      }),
    ];

    timings.push(await measureRender('vertical-scroll', async () => {
      await canvasHost.hover();
      await window.mouse.wheel(0, 420);
    }));
    timings.push(await measureRender('fit', async () => {
      await window.getByTestId('waveform-fit').click();
    }));
    timings.push(await measureRender('post-fit-zoom-in', async () => {
      await zoomInButton.click();
    }));
    const burstTimings = [] as Array<{ label: string; elapsedMs: number }>;

    for (let cycle = 0; cycle < 3; cycle += 1) {
      burstTimings.push(await measureRender(`burst-pan-${cycle}`, async () => {
        await (cycle % 2 === 0 ? panRightButton : panLeftButton).click();
      }));
      burstTimings.push(await measureRender(`burst-zoom-${cycle}`, async () => {
        await (cycle % 2 === 0 ? zoomInButton : zoomOutButton).click();
      }));
    }

    const finalStats = await readCanvasStats(canvasHost);
    const finalPanelMetrics = await readPanelMetrics(panel);
    const jsHeapAfterBurst = await readJsHeapBytes(window);

    expect(denseStats.denseSignalCount).toBeGreaterThan(0);
    expect(denseStats.denseRunCount).toBeGreaterThan(0);
    expect(denseStats.suppressedLabelCount).toBeGreaterThan(0);
    expect(finalStats.sourceSegmentCount).toBeGreaterThan(0);
    expect(finalStats.renderedSegmentCount).toBeGreaterThan(0);
    expect(finalStats.culledRowCount).toBeGreaterThan(0);
    expect(finalStats.renderResolution).toBeGreaterThanOrEqual(1);
    expect(finalStats.textureCacheBytes).toBeLessThanOrEqual(32 * 1024 * 1024);

    console.log(JSON.stringify({
      name: 'waveform-dense-render-baseline',
      renderer: await panel.getAttribute('data-renderer'),
      zoom: Number(await panel.getAttribute('data-zoom') ?? '0'),
      timings: [...timings, ...burstTimings],
      panelMetrics: {
        initial: initialPanelMetrics,
        final: finalPanelMetrics,
      },
      jsHeapBytes: {
        beforeBurst: jsHeapBeforeBurst,
        afterBurst: jsHeapAfterBurst,
        delta: jsHeapAfterBurst - jsHeapBeforeBurst,
      },
      denseStats,
      finalStats,
    }, null, 2));
  } finally {
    await app.close();
  }
});

test('packaged waveform sustained 10s viewport and interaction perf', async () => {
  test.skip(process.platform !== 'win32', 'Packaged waveform perf runs on Windows only');
  test.skip(!packagedWindowsExecutablePath, 'Run pnpm run package:win before executing packaged waveform perf');

  const { app, window } = await launchPackagedWindowsApp();

  try {
    const panel = await openWaveformPanel(window);
    const canvasHost = window.getByTestId('waveform-canvas');
    const panRightButton = window.getByRole('button', { name: /pan waveform right/i });
    const panLeftButton = window.getByRole('button', { name: /pan waveform left/i });
    const zoomInButton = window.getByTestId('waveform-zoom-in');
    const zoomOutButton = window.getByTestId('waveform-zoom-out');
    const signalRowIds = [
      'waveform-signal-row-u_top_module1-counting',
      'waveform-signal-row-dense-signal-40',
      'waveform-signal-row-tb_top_module1-clk',
    ] as const;

    await expect(canvasHost).toHaveAttribute('data-renderer', /^(webgpu|webgl)$/);
    await waitForNextRender(canvasHost, async () => {
      await zoomInButton.click();
    });

    const jsHeapBefore = await readJsHeapBytes(window);
    const samples: Array<Awaited<ReturnType<typeof capturePerfSample>>> = [];
    const phaseSnapshots = {
      panStart: await readCanvasStats(canvasHost),
      panEnd: null as Awaited<ReturnType<typeof readCanvasStats>> | null,
      zoomStart: null as Awaited<ReturnType<typeof readCanvasStats>> | null,
      zoomEnd: null as Awaited<ReturnType<typeof readCanvasStats>> | null,
      cursorStart: null as Awaited<ReturnType<typeof readCanvasStats>> | null,
      cursorEnd: null as Awaited<ReturnType<typeof readCanvasStats>> | null,
      selectionStart: null as Awaited<ReturnType<typeof readCanvasStats>> | null,
      selectionEnd: null as Awaited<ReturnType<typeof readCanvasStats>> | null,
    };
    const phaseStartedAt = Date.now();

    for (let index = 0; index < 10; index += 1) {
      await waitForNextRender(canvasHost, async () => {
        await (index % 2 === 0 ? panRightButton : panLeftButton).click();
      });
      samples.push(await capturePerfSample(window, panel, canvasHost, 'pan', Date.now() - phaseStartedAt));
      await window.waitForTimeout(250);
    }

    phaseSnapshots.panEnd = await readCanvasStats(canvasHost);
    phaseSnapshots.zoomStart = phaseSnapshots.panEnd;

    for (let index = 0; index < 10; index += 1) {
      await waitForNextRender(canvasHost, async () => {
        await (index % 2 === 0 ? zoomInButton : zoomOutButton).click();
      });
      samples.push(await capturePerfSample(window, panel, canvasHost, 'zoom', Date.now() - phaseStartedAt));
      await window.waitForTimeout(250);
    }

    phaseSnapshots.zoomEnd = await readCanvasStats(canvasHost);
    phaseSnapshots.cursorStart = phaseSnapshots.zoomEnd;

    for (let index = 0; index < 10; index += 1) {
      const box = await canvasHost.boundingBox();

      if (!box) {
        throw new Error('Expected waveform canvas bounding box for cursor perf interactions.');
      }

      const x = 40 + (index % 5) * Math.max(30, Math.floor((box.width - 80) / 5));
      const y = Math.max(40, Math.min(box.height - 40, 96));

      await waitForNextRender(canvasHost, async () => {
        await canvasHost.click({ position: { x, y } });
      });
      samples.push(await capturePerfSample(window, panel, canvasHost, 'cursor', Date.now() - phaseStartedAt));
      await window.waitForTimeout(250);
    }

    phaseSnapshots.cursorEnd = await readCanvasStats(canvasHost);
    phaseSnapshots.selectionStart = phaseSnapshots.cursorEnd;

    for (let index = 0; index < 10; index += 1) {
      await waitForNextRender(canvasHost, async () => {
        await window.getByTestId(signalRowIds[index % signalRowIds.length]).click();
      });
      samples.push(await capturePerfSample(window, panel, canvasHost, 'selection', Date.now() - phaseStartedAt));
      await window.waitForTimeout(250);
    }

    phaseSnapshots.selectionEnd = await readCanvasStats(canvasHost);

    const totalElapsedMs = Date.now() - phaseStartedAt;
    const jsHeapAfter = await readJsHeapBytes(window);
    const finalStats = await readCanvasStats(canvasHost);
    const finalPanelMetrics = await readPanelMetrics(panel);
    const panDelta = diffInteractionMetrics(phaseSnapshots.panStart, phaseSnapshots.panEnd);
    const zoomDelta = diffInteractionMetrics(phaseSnapshots.zoomStart, phaseSnapshots.zoomEnd);
    const cursorDelta = diffInteractionMetrics(phaseSnapshots.cursorStart, phaseSnapshots.cursorEnd);
    const selectionDelta = diffInteractionMetrics(phaseSnapshots.selectionStart, phaseSnapshots.selectionEnd);
    const panSamples = samples.filter((sample) => sample.phase === 'pan');
    const zoomSamples = samples.filter((sample) => sample.phase === 'zoom');
    const panVisibleRowCounts = [...new Set(panSamples.map((sample) => sample.canvasStats.visibleRowCount))];
    const zoomVisibleRowCounts = [...new Set(zoomSamples.map((sample) => sample.canvasStats.visibleRowCount))];
    const panVisibleRowCount = panVisibleRowCounts[0] ?? 0;
    const zoomVisibleRowCount = zoomVisibleRowCounts[0] ?? 0;
    const observedHeapBytes = [jsHeapBefore, ...samples.map((sample) => sample.jsHeapBytes), jsHeapAfter].filter((value) => value > 0);
    const jsHeapRange = observedHeapBytes.length > 0
      ? Math.max(...observedHeapBytes) - Math.min(...observedHeapBytes)
      : 0;

    expect(totalElapsedMs).toBeGreaterThanOrEqual(9000);
    expect(samples.length).toBe(40);
    expect(panDelta.fullSceneRebuildCount).toBe(0);
    expect(panDelta.viewportContentUpdateCount).toBeGreaterThan(0);
    expect(panDelta.panBufferHitCount).toBeGreaterThan(0);
    expect(panDelta.panPixelShiftCount).toBeGreaterThan(0);
    expect(panDelta.rowReuseCount).toBeGreaterThanOrEqual(panDelta.viewportContentUpdateCount * panVisibleRowCount);
    expect(panDelta.rowContentSkipCount).toBeGreaterThanOrEqual(panDelta.viewportContentUpdateCount);
    expect(panDelta.rowContentRedrawCount).toBeLessThan(panDelta.rowReuseCount);
    expect(zoomDelta.fullSceneRebuildCount).toBe(0);
    expect(zoomDelta.viewportContentUpdateCount).toBeGreaterThan(0);
    expect(zoomDelta.rowReuseCount).toBeGreaterThanOrEqual(zoomDelta.viewportContentUpdateCount * zoomVisibleRowCount);
    expect(zoomDelta.rowContentRedrawCount).toBeLessThan(zoomDelta.rowReuseCount);
    expect(cursorDelta.fullSceneRebuildCount).toBe(0);
    expect(cursorDelta.cursorUpdateCount).toBeGreaterThan(0);
    expect(cursorDelta.viewportContentUpdateCount).toBe(0);
    expect(selectionDelta.fullSceneRebuildCount).toBe(0);
    expect(selectionDelta.selectionUpdateCount).toBeGreaterThan(0);
    expect(selectionDelta.viewportContentUpdateCount).toBe(0);
    expect(panVisibleRowCounts).toHaveLength(1);
    expect(zoomVisibleRowCounts).toHaveLength(1);
    expect(finalStats.textureCacheBytes).toBeLessThanOrEqual(32 * 1024 * 1024);
    expect(jsHeapAfter - jsHeapBefore).toBeLessThan(64 * 1024 * 1024);
    expect(jsHeapRange).toBeLessThan(64 * 1024 * 1024);

    console.log(JSON.stringify({
      name: 'packaged-waveform-sustained-10s',
      executablePath: packagedWindowsExecutablePath,
      renderer: await panel.getAttribute('data-renderer'),
      totalElapsedMs,
      jsHeapBytes: {
        before: jsHeapBefore,
        after: jsHeapAfter,
        delta: jsHeapAfter - jsHeapBefore,
        range: jsHeapRange,
      },
      phaseDeltas: {
        pan: panDelta,
        zoom: zoomDelta,
        cursor: cursorDelta,
        selection: selectionDelta,
      },
      phaseVisibleRowCounts: {
        pan: panVisibleRowCounts,
        zoom: zoomVisibleRowCounts,
      },
      finalPanelMetrics,
      finalStats,
      samples,
    }, null, 2));
  } finally {
    await app.close();
  }
});
