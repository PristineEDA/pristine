import { test, expect, _electron as electron, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureWorkspace = path.join(__dirname, '..', 'test', 'fixtures', 'workspace');
const releaseRoot = path.join(__dirname, '..', 'release');
const MONACO_READY_TIMEOUT_MS = 15000;
const UI_READY_TIMEOUT_MS = 15000;

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

async function waitForMainUi(window: Page) {
  await window.waitForLoadState('domcontentloaded');
  await expect(window.getByTestId('toggle-activity-bar')).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
}

function isSplashWindow(entry: { title: string | null; url: string }) {
  return entry.title === 'Pristine Loading' || entry.url.endsWith('/splash.html');
}

function isMainWindow(entry: { title: string | null; url: string }) {
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

async function resolveStartupWindows(app: Awaited<ReturnType<typeof electron.launch>>) {
  const resolvedStartupWindows: {
    splashWindow: Page | null;
    window: Page | null;
  } = {
    splashWindow: null,
    window: null,
  };

  await expect.poll(async () => {
    const identifiedWindows = await getIdentifiedWindows(app);
    const splashWindow = identifiedWindows.find(isSplashWindow)?.page ?? null;
    const window = identifiedWindows.find(isMainWindow)?.page ?? null;

    if (splashWindow && !resolvedStartupWindows.splashWindow) {
      resolvedStartupWindows.splashWindow = splashWindow;
    }

    if (window) {
      resolvedStartupWindows.window = window;
    }

    return Boolean(window);
  }, {
    timeout: 10000,
  }).toBe(true);

  const window = resolvedStartupWindows.window;

  if (!window) {
    throw new Error('Expected main window during startup');
  }

  return {
    splashWindow: resolvedStartupWindows.splashWindow,
    window,
  };
}

async function waitForStartupWindow(
  app: Awaited<ReturnType<typeof electron.launch>>,
  kind: 'main' | 'splash',
) {
  const matcher = kind === 'main' ? isMainWindow : isSplashWindow;
  let resolvedWindow: Page | null = null;

  await expect.poll(async () => {
    const identifiedWindows = await getIdentifiedWindows(app);
    const window = identifiedWindows.find(matcher)?.page ?? null;

    if (window && !resolvedWindow) {
      resolvedWindow = window;
    }

    return Boolean(window);
  }, {
    timeout: 10000,
  }).toBe(true);

  const startupWindow = resolvedWindow ?? (await getIdentifiedWindows(app)).find(matcher)?.page ?? null;

  if (!startupWindow) {
    throw new Error(`Expected ${kind} window during startup`);
  }

  return startupWindow;
}

async function getWindowByTitle(app: Awaited<ReturnType<typeof electron.launch>>, title: string) {
  const titledWindows = await getIdentifiedWindows(app);

  return titledWindows.find((entry) => entry.title === title)?.page ?? null;
}

async function getStartupBrowserWindowState(app: Awaited<ReturnType<typeof electron.launch>>) {
  return app.evaluate(async ({ BrowserWindow }) => {
    return BrowserWindow.getAllWindows().map((window) => ({
      title: window.getTitle(),
      visible: window.isVisible(),
      destroyed: window.isDestroyed(),
      url: window.webContents.getURL(),
    }));
  });
}

async function isStartupBrowserWindowVisible(
  app: Awaited<ReturnType<typeof electron.launch>>,
  kind: 'main' | 'splash',
) {
  const windows = await getStartupBrowserWindowState(app);
  const matcher = kind === 'main' ? isMainWindow : isSplashWindow;
  const targetWindow = windows.find(matcher);
  return targetWindow?.visible ?? false;
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

test.skip(process.platform === 'darwin', 'Custom window controls are hidden on macOS');

async function launchApp(options?: { projectRoot?: string }) {
  const app = await electron.launch({
    args: [path.join(__dirname, '..', 'dist-electron', 'main.js')],
    env: {
      ...process.env,
      PRISTINE_E2E: '1',
      PRISTINE_PROJECT_ROOT: options?.projectRoot ?? fixtureWorkspace,
      PRISTINE_USER_DATA_PATH: getE2EUserDataPath(),
    },
  });

  const { splashWindow, window } = await resolveStartupWindows(app);
  await waitForMainUi(window);

  return { app, window, splashWindow };
}

function createWorkspaceCopy(targetPath: string) {
  fs.rmSync(targetPath, { recursive: true, force: true });
  fs.cpSync(fixtureWorkspace, targetPath, { recursive: true });
}

async function launchAppForSplashHandoff() {
  const app = await electron.launch({
    args: [path.join(__dirname, '..', 'dist-electron', 'main.js')],
    env: {
      ...process.env,
      PRISTINE_E2E: '1',
      PRISTINE_PROJECT_ROOT: fixtureWorkspace,
      PRISTINE_USER_DATA_PATH: getE2EUserDataPath(),
    },
  });

  const windowPromise = waitForStartupWindow(app, 'main');

  return { app, windowPromise };
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

  const { splashWindow, window } = await resolveStartupWindows(app);
  await waitForMainUi(window);

  return { app, window, splashWindow };
}

async function openNestedWorkspaceFile(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  pathTestIds: string[],
  options?: { finalAction?: 'click' | 'dblclick' },
) {
  const finalAction = options?.finalAction ?? 'click';

  for (const [index, testId] of pathTestIds.entries()) {
    const node = window.getByTestId(testId);
    await expect(node).toBeVisible();
    const isLastNode = index === pathTestIds.length - 1;

    if (isLastNode && finalAction === 'dblclick') {
      await node.dblclick();
      continue;
    }

    await node.click();
  }
}

async function ensureExplorerVisible(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const leftPanel = window.getByTestId('panel-left-panel');
  const readmeNode = window.getByTestId('file-tree-node-README_md');

  if (await readmeNode.count() === 0) {
    await window.getByTestId('toggle-left-panel').click();
  }

  await expect(leftPanel).toBeVisible();
  await expect(readmeNode).toBeVisible();
}

async function ensureExplorerHidden(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const readmeNode = window.getByTestId('file-tree-node-README_md');

  if (await readmeNode.count() > 0) {
    await window.getByTestId('toggle-left-panel').click();
  }

  await expect(readmeNode).toHaveCount(0);
}

async function openBottomTerminal(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const toggleBottomPanel = window.getByTestId('toggle-bottom-panel');
  await expect(toggleBottomPanel).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  if ((await toggleBottomPanel.getAttribute('aria-pressed')) !== 'true') {
    await toggleBottomPanel.click();
  }

  const terminalHost = window.getByTestId('terminal-host');
  await expect(terminalHost).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(window.locator('[data-testid="terminal-host"] .xterm')).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  return terminalHost;
}

async function switchToWhiteboard(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const whiteboardTrigger = window.getByTestId('center-view-whiteboard');

  await expect(whiteboardTrigger).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await whiteboardTrigger.click();
  await expect(window.getByTestId('whiteboard-view')).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
}

async function readTerminalText(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  return window.getByTestId('terminal-host').getAttribute('data-terminal-text');
}

async function readTerminalPid(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const value = await window.getByTestId('terminal-host').getAttribute('data-terminal-pid');
  return value ? Number(value) : NaN;
}

async function readTerminalThemeSnapshot(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  return window.getByTestId('terminal-host').evaluate((host) => {
    const browserGlobal = globalThis as unknown as {
      document: {
        body: { appendChild: (node: unknown) => void };
        documentElement: { classList: { contains: (token: string) => boolean } };
        createElement: (tagName: string) => {
          style: { backgroundColor: string };
          remove: () => void;
        };
      };
      getComputedStyle: (element: unknown) => { backgroundColor: string; fontFamily: string };
    };
    const terminalHost = host as {
      parentElement: unknown;
      querySelectorAll: (selectors: string) => ArrayLike<unknown>;
    };
    const fontSamples = Array.from(
      terminalHost.querySelectorAll('.xterm, .xterm-screen, .xterm-helpers, .xterm-char-measure-element'),
    )
      .map((element) => browserGlobal.getComputedStyle(element).fontFamily)
      .filter(Boolean);

    const probe = browserGlobal.document.createElement('div');
    const expectedColor = browserGlobal.document.documentElement.classList.contains('dark')
      ? 'var(--ide-dracula-background)'
      : '#ffffff';
    probe.style.backgroundColor = expectedColor;
    browserGlobal.document.body.appendChild(probe);
    const expectedBackground = browserGlobal.getComputedStyle(probe).backgroundColor;
    probe.remove();

    return {
      terminalBackground: browserGlobal.getComputedStyle(terminalHost.parentElement ?? terminalHost).backgroundColor,
      terminalFontFamilies: fontSamples,
      expectedBackground,
    };
  });
}

async function readMonacoAppearanceSnapshot(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  expectedColors?: { background?: string; lineNumber?: string },
) {
  return window.evaluate(({ background, lineNumber }) => {
    type StyleLike = {
      backgroundColor: string;
      color: string;
      fontFamily: string;
      fontSize: string;
    };

    type ElementLike = {
      querySelector: (selectors: string) => ElementLike | null;
      remove: () => void;
      style: Record<string, string>;
    };

    const browserGlobal = globalThis as typeof globalThis & {
      document: {
        body: { appendChild: (node: ElementLike) => void };
        createElement: (tagName: string) => ElementLike;
        querySelector: (selectors: string) => ElementLike | null;
      };
      getComputedStyle: (element: ElementLike) => StyleLike;
    };

    const editorRoot = browserGlobal.document.querySelector('.monaco-editor');

    if (!editorRoot) {
      return null;
    }

    const resolveCssColor = (property: 'backgroundColor' | 'color', value?: string) => {
      if (!value) {
        return null;
      }

      const probe = browserGlobal.document.createElement('div');
      probe.style[property] = value;
      browserGlobal.document.body.appendChild(probe);
      const normalizedColor = browserGlobal.getComputedStyle(probe)[property];
      probe.remove();

      return normalizedColor;
    };

    const backgroundElement =
      editorRoot.querySelector('.monaco-editor-background') ??
      editorRoot.querySelector('.margin') ??
      editorRoot;
    const lineNumberElement = editorRoot.querySelector('.margin .line-numbers') ?? editorRoot.querySelector('.line-numbers');
    const textLayer =
      editorRoot.querySelector('.view-lines .view-line') ??
      editorRoot.querySelector('.view-lines') ??
      editorRoot;

    return {
      backgroundColor: browserGlobal.getComputedStyle(backgroundElement).backgroundColor,
      expectedBackgroundColor: resolveCssColor('backgroundColor', background),
      expectedLineNumberColor: resolveCssColor('color', lineNumber),
      fontFamily: browserGlobal.getComputedStyle(textLayer).fontFamily,
      fontSize: browserGlobal.getComputedStyle(textLayer).fontSize,
      lineNumberColor: lineNumberElement ? browserGlobal.getComputedStyle(lineNumberElement).color : null,
    };
  }, expectedColors ?? {});
}

async function focusMonacoEditor(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const editor = window.locator('.monaco-editor');
  await expect(editor).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
  await editor.click({ position: { x: 24, y: 12 } });
  await waitForMonacoEditorTextFocus(window);
}

async function waitForMonacoEditor(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const editor = window.locator('.monaco-editor');
  await expect(editor).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
  return editor;
}

async function waitForMonacoEditorTextFocus(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  await expect.poll(() => window.evaluate(() => {
    const browserGlobal = globalThis as typeof globalThis & {
      document: {
        activeElement: Element | null;
        querySelector: (selectors: string) => Element | null;
      };
    };
    const activeElement = browserGlobal.document.activeElement;
    const textInput = browserGlobal.document.querySelector('.monaco-editor textarea.inputarea, .monaco-editor .inputarea, .monaco-editor .native-edit-context');
    return activeElement === textInput;
  }), {
    timeout: 15000,
  }).toBe(true);
}

async function expectVisibleEditorsToContainText(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  expectedCount: number,
  text: string,
) {
  const textLayers = window.locator('.monaco-editor .view-lines');

  await expect(textLayers).toHaveCount(expectedCount, { timeout: MONACO_READY_TIMEOUT_MS });

  for (let index = 0; index < expectedCount; index += 1) {
    await expect(textLayers.nth(index)).toContainText(text, { timeout: MONACO_READY_TIMEOUT_MS });
  }
}

async function moveMonacoCursor(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  movement: { down?: number; right?: number },
) {
  await focusMonacoEditor(window);
  await window.keyboard.press('Control+Home');
  await window.keyboard.press('Home');

  for (let index = 0; index < (movement.down ?? 0); index += 1) {
    await window.keyboard.press('ArrowDown');
  }

  for (let index = 0; index < (movement.right ?? 0); index += 1) {
    await window.keyboard.press('ArrowRight');
  }
}

function getCursorStatus(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  return window.getByText(/^Ln \d+, Col \d+$/);
}

async function clearRememberedCloseBehavior(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  await window.evaluate(async () => {
    const browserGlobal = globalThis as typeof globalThis & {
      electronAPI?: {
        config: {
          set: (key: string, value: unknown) => Promise<void>;
        };
      };
    };

    await browserGlobal.electronAPI?.config.set('window.closeActionPreference', null);
  });

  await expect.poll(async () => readConfigValue(window, 'window.closeActionPreference')).toBe(null);
}

async function setFloatingInfoWindowVisibility(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  visible: boolean,
) {
  await window.evaluate(async ({ nextVisible }) => {
    const browserGlobal = globalThis as typeof globalThis & {
      electronAPI?: {
        config: {
          set: (key: string, value: unknown) => Promise<void>;
        };
        setFloatingInfoWindowVisible: (visible: boolean) => Promise<boolean>;
      };
    };

    await browserGlobal.electronAPI?.config.set('ui.floatingInfoWindow.visible', nextVisible);
    await browserGlobal.electronAPI?.setFloatingInfoWindowVisible(nextVisible);
  }, { nextVisible: visible });
}

async function readConfigValue(window: Awaited<ReturnType<typeof launchApp>>['window'], key: string) {
  return window.evaluate((configKey) => {
    const browserGlobal = globalThis as typeof globalThis & {
      electronAPI?: {
        config: {
          get: (key: string) => unknown;
        };
      };
    };

    return browserGlobal.electronAPI?.config.get(configKey) ?? null;
  }, key);
}

async function setSwitchChecked(locator: Locator, checked: boolean) {
  const dataState = await locator.getAttribute('data-state');
  const currentlyChecked = dataState === 'checked';

  if (currentlyChecked !== checked) {
    await locator.click();
    await expect(locator).toHaveAttribute('data-state', checked ? 'checked' : 'unchecked');
  }
}

async function selectComboboxOption(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  triggerTestId: string,
  optionTestId: string,
) {
  await window.getByTestId(triggerTestId).click();
  await expect(window.getByTestId(optionTestId)).toBeVisible();
  await window.getByTestId(optionTestId).click();
}

async function readComboboxListSnapshot(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  listTestId: string,
  selectedOptionTestId: string,
) {
  const list = window.locator(`[data-combobox-list="${listTestId}"]`)

  return list.evaluate((listElement, selectedTestId) => {
    type RectLike = {
      top: number
      bottom: number
    }

    type ElementLike = {
      clientHeight: number
      getBoundingClientRect: () => RectLike
      querySelector: (selector: string) => ElementLike | null
      scrollHeight: number
      scrollTop: number
    }

    const listNode = listElement as unknown as ElementLike
    const selectedNode = listNode.querySelector(`[data-testid="${selectedTestId}"]`)

    if (!selectedNode) {
      return null
    }

    const listRect = listNode.getBoundingClientRect()
    const selectedRect = selectedNode.getBoundingClientRect()

    return {
      clientHeight: listNode.clientHeight,
      scrollHeight: listNode.scrollHeight,
      scrollTop: listNode.scrollTop,
      selectedFullyVisible:
        selectedRect.top >= listRect.top &&
        selectedRect.bottom <= listRect.bottom,
    }
  }, selectedOptionTestId)
}

async function setEditorFontSizePreset(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  preset: 'min' | 'max',
) {
  const sliderThumb = window.locator('[data-testid="settings-editor-font-size-slider"] [role="slider"]');
  await expect(sliderThumb).toBeVisible();
  await sliderThumb.focus();
  await sliderThumb.press(preset === 'max' ? 'End' : 'Home');
}

async function requestWindowClose(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  await window.getByTestId('window-control-close').click();
}

async function selectMenuBarItem(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  menuLabel: string,
  itemLabel: string,
) {
  const menuTrigger = window.locator('[data-slot="menubar-trigger"]').filter({ hasText: menuLabel }).first();
  await expect(menuTrigger).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await menuTrigger.click();

  const menuContent = window.locator('[data-slot="menubar-content"]').last();
  await expect(menuContent).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  const menuItem = menuContent.locator('[data-slot="menubar-item"]').filter({ hasText: itemLabel }).first();
  await expect(menuItem).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await menuItem.click();
}

function isProcessRunning(pid: number) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

test('app launches and shows main UI', async () => {
  const { app, window } = await launchApp();

  const title = await window.title();
  expect(title).toContain('Pristine');

  await app.close();
});

test('splash window hands off to the main window after the startup delay', async () => {
  test.slow();

  const launchStartedAt = Date.now();
  const splashMidpointCheckMs = 2000;
  const { app, windowPromise } = await launchAppForSplashHandoff();

  await expect.poll(async () => isStartupBrowserWindowVisible(app, 'splash')).toBe(true);
  await expect.poll(async () => isStartupBrowserWindowVisible(app, 'main')).toBe(false);

  const elapsedBeforeMidpointCheck = Date.now() - launchStartedAt;
  if (elapsedBeforeMidpointCheck < splashMidpointCheckMs) {
    await expect.poll(() => Date.now() - launchStartedAt, {
      timeout: splashMidpointCheckMs - elapsedBeforeMidpointCheck + 1000,
    }).toBeGreaterThanOrEqual(splashMidpointCheckMs);

    await expect.poll(async () => isStartupBrowserWindowVisible(app, 'splash')).toBe(true);
    await expect.poll(async () => isStartupBrowserWindowVisible(app, 'main')).toBe(false);
  }

  await expect.poll(async () => isStartupBrowserWindowVisible(app, 'splash'), {
    timeout: 15000,
  }).toBe(false);
  const window = await windowPromise;

  expect(Date.now() - launchStartedAt).toBeGreaterThanOrEqual(3000);

  await expect.poll(() => app.windows().length).toBe(1);
  await expect.poll(async () => isStartupBrowserWindowVisible(app, 'main')).toBe(true);
  await expect(window.getByTestId('activity-item-explorer')).toBeVisible();

  await app.close();
});

test('packaged Windows app keeps the splash handoff working during startup', async () => {
  test.skip(process.platform !== 'win32', 'Packaged splash E2E runs on Windows only');
  test.skip(!packagedWindowsExecutablePath, 'Run pnpm run package:win before executing packaged splash E2E');

  const { app, window } = await launchPackagedWindowsApp();
  const mainBrowserWindow = await app.browserWindow(window);

  await expect.poll(() => app.windows().length, { timeout: 15000 }).toBe(1);
  await expect.poll(async () => mainBrowserWindow.evaluate((browserWindow) => browserWindow.isVisible()), {
    timeout: 15000,
  }).toBe(true);
  await expect(window.getByTestId('activity-item-explorer')).toBeVisible();

  await app.close();
});

test('window controls toggle minimize and maximize state', async () => {
  const { app, window } = await launchApp();
  const browserWindow = await app.browserWindow(window);

  const maximizeButton = window.getByTestId('window-control-maximize');
  await expect(maximizeButton).toBeVisible();
  await maximizeButton.click();
  await expect.poll(async () => browserWindow.evaluate((win) => win.isMaximized())).toBe(true);

  await maximizeButton.click();
  await expect.poll(async () => browserWindow.evaluate((win) => win.isMaximized())).toBe(false);

  const minimizeButton = window.getByTestId('window-control-minimize');
  await expect(minimizeButton).toBeVisible();
  await minimizeButton.click();
  await expect.poll(async () => browserWindow.evaluate((win) => win.isMinimized())).toBe(true);

  await browserWindow.evaluate((win) => win.restore());
  await expect.poll(async () => browserWindow.evaluate((win) => win.isMinimized())).toBe(false);

  await app.close();
});

test('File > Setting... opens the settings dialog and updates persisted options', async () => {
  const { app, window } = await launchApp();

  await clearRememberedCloseBehavior(window);
  await selectMenuBarItem(window, 'File', 'Setting...');
  await expect(window.getByTestId('settings-dialog')).toBeVisible();

  await setSwitchChecked(window.getByTestId('settings-close-to-tray-switch'), true);
  await expect.poll(async () => readConfigValue(window, 'window.closeActionPreference')).toBe('tray');

  await window.getByTestId('settings-close-button').click();
  await clearRememberedCloseBehavior(window);

  await app.close();
});

test('File > Close hides the app to tray when close-to-tray is enabled', async () => {
  const { app, window } = await launchApp();
  const browserWindow = await app.browserWindow(window);

  await clearRememberedCloseBehavior(window);
  await selectMenuBarItem(window, 'File', 'Setting...');
  await expect(window.getByTestId('settings-dialog')).toBeVisible();
  await setSwitchChecked(window.getByTestId('settings-close-to-tray-switch'), true);
  await expect.poll(async () => readConfigValue(window, 'window.closeActionPreference')).toBe('tray');
  await window.getByTestId('settings-close-button').click();

  await selectMenuBarItem(window, 'File', 'Close');
  await expect.poll(async () => browserWindow.evaluate((win) => win.isVisible())).toBe(false);
  await expect.poll(() => app.windows().length).toBe(1);

  await browserWindow.evaluate((win) => {
    win.show();
    win.focus();
  });
  await expect.poll(async () => browserWindow.evaluate((win) => win.isVisible())).toBe(true);

  await clearRememberedCloseBehavior(window);
  await app.close();
});

test('Ctrl+Q or Cmd+Q hides the app to tray when close-to-tray is enabled', async () => {
  const { app, window } = await launchApp();
  const browserWindow = await app.browserWindow(window);
  const closeShortcut = process.platform === 'darwin' ? 'Meta+Q' : 'Control+Q';

  await clearRememberedCloseBehavior(window);
  await selectMenuBarItem(window, 'File', 'Setting...');
  await expect(window.getByTestId('settings-dialog')).toBeVisible();
  await setSwitchChecked(window.getByTestId('settings-close-to-tray-switch'), true);
  await expect.poll(async () => readConfigValue(window, 'window.closeActionPreference')).toBe('tray');
  await window.getByTestId('settings-close-button').click();
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0);

  await window.bringToFront();
  const activityBarTrigger = window.getByTestId('toggle-activity-bar');
  await activityBarTrigger.focus();
  await activityBarTrigger.press(closeShortcut);

  await expect.poll(async () => browserWindow.evaluate((win) => win.isVisible())).toBe(false);
  await expect.poll(() => app.windows().length).toBe(1);

  await browserWindow.evaluate((win) => {
    win.show();
    win.focus();
  });
  await expect.poll(async () => browserWindow.evaluate((win) => win.isVisible())).toBe(true);

  await clearRememberedCloseBehavior(window);
  await app.close();
});

test('close button hides the app to tray when close-to-tray is enabled', async () => {
  const { app, window } = await launchApp();
  const browserWindow = await app.browserWindow(window);

  await clearRememberedCloseBehavior(window);
  await window.getByTestId('menu-settings-button').click();
  await expect(window.getByTestId('settings-dialog')).toBeVisible();
  await setSwitchChecked(window.getByTestId('settings-close-to-tray-switch'), false);
  await setSwitchChecked(window.getByTestId('settings-close-to-tray-switch'), true);
  await expect.poll(async () => readConfigValue(window, 'window.closeActionPreference')).toBe('tray');
  await window.getByTestId('settings-close-button').click();

  await requestWindowClose(window);
  await expect.poll(async () => browserWindow.evaluate((win) => win.isVisible())).toBe(false);
  await expect.poll(() => app.windows().length).toBe(1);

  await browserWindow.evaluate((win) => {
    win.show();
    win.focus();
  });
  await expect.poll(async () => browserWindow.evaluate((win) => win.isVisible())).toBe(true);

  await app.close();
});

test('close-to-tray keeps the active terminal session alive and restores it after reopening', async () => {
  const { app, window } = await launchApp();
  const browserWindow = await app.browserWindow(window);
  const marker = '__PRISTINE_TRAY_TERMINAL__';

  await clearRememberedCloseBehavior(window);
  await window.getByTestId('menu-settings-button').click();
  await expect(window.getByTestId('settings-dialog')).toBeVisible();
  await setSwitchChecked(window.getByTestId('settings-close-to-tray-switch'), false);
  await setSwitchChecked(window.getByTestId('settings-close-to-tray-switch'), true);
  await expect.poll(async () => readConfigValue(window, 'window.closeActionPreference')).toBe('tray');
  await window.getByTestId('settings-close-button').click();

  await openBottomTerminal(window);
  await expect.poll(async () => readTerminalPid(window), {
    timeout: 15000,
  }).toBeGreaterThan(0);

  const terminalInput = window.locator('[data-testid="terminal-host"] .xterm-helper-textarea');
  await expect(terminalInput).toHaveCount(1);
  await terminalInput.click();
  await terminalInput.pressSequentially(`echo ${marker}`);
  await terminalInput.press('Enter');

  await expect.poll(async () => readTerminalText(window), {
    timeout: 15000,
  }).toContain(marker);

  const originalPid = await readTerminalPid(window);
  expect(isProcessRunning(originalPid)).toBe(true);

  await requestWindowClose(window);
  await expect.poll(async () => browserWindow.evaluate((win) => win.isVisible())).toBe(false);
  expect(isProcessRunning(originalPid)).toBe(true);

  await browserWindow.evaluate((win) => {
    win.show();
    win.focus();
  });

  await expect.poll(async () => browserWindow.evaluate((win) => win.isVisible())).toBe(true);
  await openBottomTerminal(window);
  await expect.poll(async () => readTerminalPid(window), {
    timeout: 15000,
  }).toBe(originalPid);
  await expect.poll(async () => readTerminalText(window), {
    timeout: 15000,
  }).toContain(marker);

  await window.evaluate(async () => {
    const browserGlobal = globalThis as typeof globalThis & {
      electronAPI?: {
        config: {
          set: (key: string, value: unknown) => Promise<void>;
        };
      };
    };

    await browserGlobal.electronAPI?.config.set('window.closeActionPreference', null);
  });

  await app.close();
});

test('explorer opens a file into a new editor tab', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  const fileNode = window.getByTestId('file-tree-node-README_md');
  await expect(fileNode).toBeVisible();
  await fileNode.click();

  await expect(window.getByTestId('editor-tab-README.md')).toBeVisible();
  await expect(window.locator('.monaco-editor .view-lines')).toContainText('Fixture Workspace', {
    timeout: MONACO_READY_TIMEOUT_MS,
  });

  await app.close();
});

test('systemverilog lsp smoke resolves a cross-file definition and symbol references', async () => {
  test.slow();

  const { app, window } = await launchApp();
  const aluInstantiationLine = '  alu u_alu ();';
  const dataReadyDeclarationLine = '  logic data_ready;';
  const aluSource = [
    'module alu;',
    'endmodule',
  ].join('\n');
  const cpuTopSource = [
    'module cpu_top;',
    '  logic data_ready;',
    '',
    '  alu u_alu ();',
    '',
    "  assign data_ready = 1'b1;",
    'endmodule',
  ].join('\n');

  await ensureExplorerVisible(window);
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_cpu_top_sv',
  ]);

  await expect(window.getByTestId('editor-tab-rtl/core/cpu_top.sv')).toBeVisible();
  await expect(window.locator('.monaco-editor .view-lines')).toContainText('alu u_alu', {
    timeout: MONACO_READY_TIMEOUT_MS,
  });

  await window.evaluate(async ({ nextAluSource, nextCpuTopSource }) => {
    const browserGlobal = globalThis as typeof globalThis & {
      electronAPI?: {
        lsp: {
          openDocument: (filePath: string, languageId: string, text: string) => Promise<void>;
        };
      };
    };

    await browserGlobal.electronAPI?.lsp.openDocument('rtl/core/alu.sv', 'systemverilog', nextAluSource);
    await browserGlobal.electronAPI?.lsp.openDocument('rtl/core/cpu_top.sv', 'systemverilog', nextCpuTopSource);
  }, {
    nextAluSource: aluSource,
    nextCpuTopSource: cpuTopSource,
  });

  await expect.poll(async () => window.evaluate(async ({ definitionCharacter, referencesCharacter }) => {
    const browserGlobal = globalThis as typeof globalThis & {
      electronAPI?: {
        lsp: {
          definition: (filePath: string, line: number, character: number) => Promise<Array<{ filePath: string }>>;
          references: (filePath: string, line: number, character: number, includeDeclaration?: boolean) => Promise<Array<{ filePath: string }>>;
        };
      };
    };

    try {
      const definition = await browserGlobal.electronAPI?.lsp.definition('rtl/core/cpu_top.sv', 3, definitionCharacter);
      const references = await browserGlobal.electronAPI?.lsp.references('rtl/core/cpu_top.sv', 1, referencesCharacter, true);

      return {
        definitionFilePath: definition?.[0]?.filePath ?? null,
        hasAtLeastTwoReferences: (references?.length ?? 0) >= 2,
        allReferencePathsLocal: (references?.every((entry) => entry.filePath === 'rtl/core/cpu_top.sv') ?? false),
      };
    } catch {
      return {
        definitionFilePath: null,
        hasAtLeastTwoReferences: false,
        allReferencePathsLocal: false,
      };
    }
  }, {
    definitionCharacter: aluInstantiationLine.indexOf('alu'),
    referencesCharacter: dataReadyDeclarationLine.indexOf('data_ready'),
  }), {
    timeout: 15000,
  }).toMatchObject({
    definitionFilePath: 'rtl/core/alu.sv',
    hasAtLeastTwoReferences: true,
    allReferencePathsLocal: true,
  });

  await app.close();
});

test('single-clicked explorer files stay in preview style until double-clicked to pin', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  const readmeNode = window.getByTestId('file-tree-node-README_md');
  await readmeNode.click();

  const previewTitle = window.getByTestId('editor-tab-title-README.md');
  await expect(previewTitle).toHaveClass(/italic/);
  await expect(window.getByTestId('editor-tab-preview-indicator-README.md')).toBeVisible();

  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ]);

  await expect(window.getByTestId('editor-tab-README.md')).toHaveCount(0);
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(window.getByTestId('editor-tab-title-rtl/core/reg_file.v')).toHaveClass(/italic/);

  const regFileNode = window.getByTestId('file-tree-node-rtl_core_reg_file_v');
  await regFileNode.dblclick();

  await expect(window.getByTestId('editor-tab-title-rtl/core/reg_file.v')).not.toHaveClass(/italic/);
  await expect(window.getByTestId('editor-tab-preview-indicator-rtl/core/reg_file.v')).toHaveCount(0);

  await readmeNode.click();
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(window.getByTestId('editor-tab-README.md')).toBeVisible();

  await app.close();
});

test('editing a preview tab pins it so the next preview open does not replace it', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ]);

  await expect(window.getByTestId('editor-tab-title-rtl/core/reg_file.v')).toHaveClass(/italic/);
  await expect(window.getByTestId('editor-tab-preview-indicator-rtl/core/reg_file.v')).toBeVisible();

  await waitForMonacoEditor(window);
  await focusMonacoEditor(window);
  await waitForMonacoEditorTextFocus(window);
  await window.keyboard.press('End');
  await window.keyboard.type(' // preview pinned by edit');

  await expect(window.getByTestId('editor-tab-title-rtl/core/reg_file.v')).not.toHaveClass(/italic/);
  await expect(window.getByTestId('editor-tab-preview-indicator-rtl/core/reg_file.v')).toHaveCount(0);
  await expect(window.getByTestId('editor-tab-dirty-indicator-rtl/core/reg_file.v')).toBeVisible();

  await window.getByTestId('file-tree-node-README_md').click();

  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(window.getByTestId('editor-tab-README.md')).toBeVisible();
  await expect(window.getByTestId('editor-tab-preview-indicator-README.md')).toBeVisible();

  await app.evaluate(({ app: electronApp }) => {
    electronApp.quit();
  });
});

test('ctrl+s saves an edited explorer file and clears the dirty indicator', async () => {
  const workspaceCopy = test.info().outputPath('save-workspace');
  createWorkspaceCopy(workspaceCopy);

  const filePath = path.join(workspaceCopy, 'rtl', 'core', 'reg_file.v');
  const marker = `// e2e save marker ${Date.now()}`;
  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await openNestedWorkspaceFile(window, [
      'file-tree-node-rtl',
      'file-tree-node-rtl_core',
      'file-tree-node-rtl_core_reg_file_v',
    ], { finalAction: 'dblclick' });

    await waitForMonacoEditor(window);
    await focusMonacoEditor(window);
    await waitForMonacoEditorTextFocus(window);
    await window.keyboard.press('Control+End');
    await window.keyboard.type(`\n${marker}`);

    await expect(window.getByTestId('editor-tab-dirty-indicator-rtl/core/reg_file.v')).toBeVisible();

    await window.keyboard.press('Control+S');

    await expect(window.getByTestId('editor-tab-dirty-indicator-rtl/core/reg_file.v')).toHaveCount(0);
    await expect.poll(() => fs.readFileSync(filePath, 'utf-8'), {
      timeout: 15000,
    }).toContain(marker);
  } finally {
    await app.close();
  }
});

test('menu bar switches to the whiteboard view and renders the React Flow UI chrome', async () => {
  const { app, window } = await launchApp();

  await switchToWhiteboard(window);
  await expect(window.getByTestId('whiteboard-react-flow')).toHaveClass(/light/);
  await expect(window.locator('[data-testid="whiteboard-controls-wrapper"] .react-flow__controls')).toBeVisible();
  await expect(window.getByTestId('rf__minimap')).toBeVisible();
  await expect(window.getByTestId('rf__background')).toBeVisible();

  await app.close();
});

test('whiteboard creates draggable nodes on the React Flow canvas', async () => {
  const { app, window } = await launchApp();

  await switchToWhiteboard(window);

  const addNodeButton = window.getByTestId('whiteboard-add-node');
  await expect(addNodeButton).toBeVisible();

  await addNodeButton.click();
  await expect(window.getByTestId('whiteboard-node-count')).toHaveText('Nodes: 1');

  const node = window.locator('.react-flow__node').filter({ hasText: 'Node 1' });
  await expect(node).toBeVisible();

  const box = await node.boundingBox();
  if (!box) {
    throw new Error('Node 1 bounding box was not available');
  }

  await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await window.mouse.down();
  await window.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80, { steps: 12 });
  await window.mouse.up();

  await expect(window.getByTestId('whiteboard-last-dragged-node')).not.toHaveText('Last drag: none');
  await expect(window.getByTestId('whiteboard-last-dragged-node')).toContainText('node-1:');

  await app.close();
});

test('ctrl+p quick open searches files, navigates results, and reveals the selected file', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await window.getByTestId('file-tree-node-README_md').click();
  await expect(window.getByTestId('editor-tab-README.md')).toBeVisible();

  await window.keyboard.press('Control+P');

  const quickOpen = window.getByTestId('quick-open-overlay');
  const quickOpenInput = window.getByTestId('quick-open-input');
  await expect(quickOpen).toBeVisible();
  await expect(quickOpenInput).toBeFocused();
  await expect(window.getByTestId('quick-open-result-README_md')).toBeVisible();
  await expect(quickOpen).not.toContainText('RECENT');
  await expect(quickOpen).not.toContainText('Recently opened');

  await quickOpenInput.fill('reg');
  await expect(window.getByTestId('quick-open-result-rtl_core_reg_file_v')).toBeVisible();
  await expect(window.getByTestId('quick-open-path-rtl_core_reg_file_v')).toHaveText('rtl/core');
  await expect(window.getByTestId('quick-open-result-ignored_secret_txt')).toHaveCount(0);
  await expect(window.getByTestId('quick-open-result-_git_config')).toHaveCount(0);
  await quickOpenInput.press('Enter');

  await expect(quickOpen).toHaveCount(0);
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(window.getByTestId('file-tree-node-rtl')).toBeVisible();
  await expect(window.getByTestId('file-tree-node-rtl_core')).toBeVisible();
  await expect(window.getByTestId('file-tree-node-rtl_core_reg_file_v')).toBeVisible();

  await window.keyboard.press('Control+P');
  await expect(window.getByTestId('quick-open-result-rtl_core_reg_file_v')).toBeVisible();

  await app.close();
});

test('ctrl+p quick open opens files without forcing the hidden explorer visible', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerHidden(window);

  await window.keyboard.press('Control+P');

  const quickOpenInput = window.getByTestId('quick-open-input');
  await expect(quickOpenInput).toBeFocused();
  await quickOpenInput.fill('reg');
  await expect(window.getByTestId('quick-open-result-rtl_core_reg_file_v')).toBeVisible();
  await quickOpenInput.press('Enter');

  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(window.getByTestId('file-tree-node-README_md')).toHaveCount(0);

  await app.close();
});

test('ctrl+p quick open shows recent files in recency order and deduplicates reopened entries', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);

  const readmeNode = window.getByTestId('file-tree-node-README_md');
  await readmeNode.click();
  await expect(window.getByTestId('editor-tab-README.md')).toBeVisible();

  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ]);
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();

  await readmeNode.click();
  await expect(window.getByTestId('editor-tab-README.md')).toBeVisible();

  await window.keyboard.press('Control+P');
  await expect(window.getByTestId('quick-open-input')).toBeFocused();

  const recentOrder = await window.locator('[data-testid^="quick-open-result-"]').evaluateAll((elements) => {
    return elements.map((element) => {
      const htmlElement = element as { getAttribute: (name: string) => string | null };
      return htmlElement.getAttribute('data-testid') ?? '';
    });
  });

  expect(recentOrder.slice(0, 2)).toEqual([
    'quick-open-result-README_md',
    'quick-open-result-rtl_core_reg_file_v',
  ]);
  expect(recentOrder.filter((value) => value === 'quick-open-result-README_md')).toHaveLength(1);

  await window.keyboard.press('Escape');
  await expect(window.getByTestId('quick-open-overlay')).toHaveCount(0);

  await app.close();
});

test('ctrl+p quick open keyboard navigation opens the selected recent file', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);

  const readmeNode = window.getByTestId('file-tree-node-README_md');
  await readmeNode.click();
  await expect(window.getByTestId('editor-tab-README.md')).toBeVisible();

  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ]);
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();

  await readmeNode.click();
  await expect(window.getByTestId('editor-tab-README.md')).toHaveClass(/bg-background/);

  await window.keyboard.press('Control+P');
  const quickOpenInput = window.getByTestId('quick-open-input');
  await expect(quickOpenInput).toBeFocused();

  await quickOpenInput.press('ArrowDown');
  await quickOpenInput.press('Enter');

  await expect(window.getByTestId('quick-open-overlay')).toHaveCount(0);
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveClass(/bg-background/);
  await expect(window.getByTestId('editor-tab-README.md')).not.toHaveClass(/bg-background/);

  await app.close();
});

test('ctrl+p quick open search keyboard navigation opens the selected filtered file', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);

  await window.keyboard.press('Control+P');
  const quickOpenInput = window.getByTestId('quick-open-input');
  await expect(quickOpenInput).toBeFocused();

  await quickOpenInput.fill('r');
  await expect(window.getByTestId('quick-open-result-README_md')).toBeVisible();
  await expect(window.getByTestId('quick-open-result-rtl_core_reg_file_v')).toBeVisible();

  await quickOpenInput.press('ArrowDown');
  await quickOpenInput.press('Enter');

  await expect(window.getByTestId('quick-open-overlay')).toHaveCount(0);
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(window.getByTestId('editor-tab-preview-indicator-rtl/core/reg_file.v')).toHaveCount(0);
  await expect(window.locator('.monaco-editor .view-lines')).toContainText('module reg_file', {
    timeout: MONACO_READY_TIMEOUT_MS,
  });

  await app.close();
});

test('ctrl+p quick open escape closes the palette and reopening resets the query', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await window.getByTestId('file-tree-node-README_md').click();
  await expect(window.getByTestId('editor-tab-README.md')).toBeVisible();

  await window.keyboard.press('Control+P');
  const quickOpenInput = window.getByTestId('quick-open-input');
  await expect(quickOpenInput).toBeFocused();

  await quickOpenInput.fill('reg');
  await expect(window.getByTestId('quick-open-result-rtl_core_reg_file_v')).toBeVisible();

  await quickOpenInput.press('Escape');
  await expect(window.getByTestId('quick-open-overlay')).toHaveCount(0);

  await window.keyboard.press('Control+P');
  const reopenedInput = window.getByTestId('quick-open-input');
  await expect(reopenedInput).toBeFocused();
  await expect(reopenedInput).toHaveValue('');
  await expect(window.getByTestId('quick-open-result-README_md')).toBeVisible();

  await app.close();
});

test('single-clicking the first explorer file places the monaco cursor at line 1 column 1', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ]);

  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(window.getByTestId('editor-tab-title-rtl/core/reg_file.v')).toHaveClass(/italic/);
  await waitForMonacoEditor(window);
  await expect(getCursorStatus(window)).toHaveText('Ln 1, Col 1');

  await window.keyboard.press('ArrowDown');
  await expect(getCursorStatus(window)).toHaveText('Ln 2, Col 1');

  await app.close();
});

test('quick open places the first opened file cursor at line 1 column 1', async () => {
  const { app, window } = await launchApp();

  await window.keyboard.press('Control+P');

  const quickOpenInput = window.getByTestId('quick-open-input');
  await expect(quickOpenInput).toBeFocused();
  await quickOpenInput.fill('reg');
  await expect(window.getByTestId('quick-open-result-rtl_core_reg_file_v')).toBeVisible();
  await quickOpenInput.press('Enter');

  await expect(window.getByTestId('quick-open-overlay')).toHaveCount(0);
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await waitForMonacoEditor(window);
  await waitForMonacoEditorTextFocus(window);
  await expect(getCursorStatus(window)).toHaveText('Ln 1, Col 1');

  await window.keyboard.press('ArrowDown');
  await expect(getCursorStatus(window)).toHaveText('Ln 2, Col 1');

  await app.close();
});

test('monaco restores cursor position across file switches and tab reopen while new files start at line 1 column 1', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ], { finalAction: 'dblclick' });

  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(getCursorStatus(window)).toHaveText('Ln 1, Col 1');

  await moveMonacoCursor(window, { down: 3, right: 4 });
  await expect(getCursorStatus(window)).toHaveText('Ln 4, Col 5');

  await window.getByTestId('file-tree-node-README_md').dblclick();
  await expect(window.getByTestId('editor-tab-README.md')).toBeVisible();
  await expect(getCursorStatus(window)).toHaveText('Ln 1, Col 1');

  await window.getByTestId('editor-tab-rtl/core/reg_file.v').click();
  await expect(getCursorStatus(window)).toHaveText('Ln 4, Col 5');

  await window.getByTestId('editor-tab-close-rtl/core/reg_file.v').click();
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveCount(0);

  await window.getByTestId('file-tree-node-rtl_core_reg_file_v').dblclick();
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(getCursorStatus(window)).toHaveText('Ln 4, Col 5');

  await app.close();
});

test('ctrl+p quick open escape restores the previous editor cursor position and monaco focus', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ]);

  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await moveMonacoCursor(window, { down: 2, right: 6 });
  await expect(getCursorStatus(window)).toHaveText('Ln 3, Col 7');

  await window.keyboard.press('Control+P');
  const quickOpenInput = window.getByTestId('quick-open-input');
  await expect(quickOpenInput).toBeFocused();

  await quickOpenInput.fill('read');
  await quickOpenInput.press('Escape');

  await expect(window.getByTestId('quick-open-overlay')).toHaveCount(0);
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveClass(/bg-background/);
  await expect(getCursorStatus(window)).toHaveText('Ln 3, Col 7');

  await window.keyboard.press('ArrowDown');
  await expect(getCursorStatus(window)).toHaveText('Ln 4, Col 7');

  await app.close();
});

test('explorer root supports toggle and collapse all behaviors', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  const collapseAllButton = window.getByRole('button', { name: 'Collapse All' });
  const rootNode = window.getByTestId('file-tree-node-root');
  const rtlNode = window.getByTestId('file-tree-node-rtl');

  await expect(collapseAllButton).toBeVisible();
  await expect(rootNode).toBeVisible();
  await expect(rtlNode).toBeVisible();

  await test.step('root row collapses and expands first-level children', async () => {
    await rootNode.click();
    await expect(rtlNode).toHaveCount(0);

    await rootNode.click();
    await expect(rtlNode).toBeVisible();
  });

  await test.step('collapse all hides root children while keeping root visible', async () => {
    await collapseAllButton.click();

    await expect(rootNode).toBeVisible();
    await expect(rtlNode).toHaveCount(0);
  });

  await app.close();
});

test('activity bar switches code subpages and menu bar keeps higher-priority page navigation', async () => {
  const { app, window } = await launchApp();
  const activityBarTrigger = window.getByTestId('toggle-activity-bar');

  await expect(activityBarTrigger).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(window.getByTestId('panel-center-panel')).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(window.getByTestId('activity-item-explorer')).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(window.getByTestId('activity-item-simulation')).toBeVisible();
  await expect(window.getByTestId('activity-item-synthesis')).toBeVisible();
  await expect(window.getByTestId('activity-item-physical')).toBeVisible();
  await expect(window.getByTestId('activity-item-factory')).toBeVisible();
  await expect(window.getByTestId('activity-item-git')).toHaveCount(0);
  await expect(window.getByTestId('activity-item-search')).toHaveCount(0);
  await expect(window.getByTestId('activity-item-extensions')).toHaveCount(0);

  await expect(window.getByTestId('panel-center-panel')).toBeVisible();
  await expect(window.getByTestId('toggle-left-panel')).toBeEnabled();
  await expect(window.getByTestId('toggle-bottom-panel')).toBeEnabled();
  await expect(window.getByTestId('toggle-right-panel')).toBeEnabled();

  await window.getByTestId('activity-item-simulation').click();
  await expect(window.getByTestId('code-view-simulation')).toBeVisible();
  await expect(window.getByTestId('panel-simulation-center-panel')).toBeVisible();
  await expect(window.getByTestId('panel-simulation-left-panel')).toBeVisible();
  await expect(window.getByTestId('panel-simulation-bottom-panel')).toBeVisible();
  await expect(window.getByTestId('panel-simulation-right-panel')).toBeVisible();
  await expect(window.getByTestId('simulation-left-panel-content')).toContainText('Left Panel');
  await expect(window.getByTestId('simulation-main-panel-content')).toContainText('Simulation Workspace');

  await window.getByTestId('toggle-left-panel').click();
  await window.getByTestId('toggle-bottom-panel').click();
  await expect(window.getByTestId('panel-simulation-left-panel')).toHaveCount(0);
  await expect(window.getByTestId('panel-simulation-bottom-panel')).toHaveCount(0);
  await expect(window.getByTestId('panel-simulation-right-panel')).toBeVisible();

  await window.getByTestId('activity-item-synthesis').click();
  await expect(window.getByTestId('code-view-synthesis')).toBeVisible();
  await expect(window.getByTestId('toggle-left-panel')).toBeDisabled();
  await expect(window.getByTestId('toggle-bottom-panel')).toBeDisabled();
  await expect(window.getByTestId('toggle-right-panel')).toBeDisabled();
  await expect(window.getByTestId('toggle-activity-bar')).toBeEnabled();
  await window.getByTestId('toggle-activity-bar').click();
  await expect(window.getByTestId('activity-item-physical').getByText('Physical')).toBeVisible();
  await window.getByTestId('toggle-activity-bar').click();
  await expect(window.getByTestId('activity-item-physical').getByText('Physical')).toBeVisible();

  await window.getByTestId('activity-item-physical').click();
  await expect(window.getByTestId('code-view-physical')).toBeVisible();

  await window.getByTestId('activity-item-factory').click();
  await expect(window.getByTestId('code-view-factory')).toBeVisible();

  await switchToWhiteboard(window);
  await expect(window.getByTestId('whiteboard-view')).toBeVisible();
  await expect(window.getByTestId('activity-item-explorer')).toHaveCount(0);
  await expect(activityBarTrigger).toBeDisabled();
  await expect(activityBarTrigger).toHaveAttribute('aria-pressed', 'false');
  await expect(window.getByTestId('toggle-left-panel')).toBeDisabled();
  await expect(window.getByTestId('toggle-bottom-panel')).toBeDisabled();
  await expect(window.getByTestId('toggle-right-panel')).toBeDisabled();

  await window.getByLabel('Workflow').click();
  await expect(window.getByTestId('workflow-view')).toBeVisible();
  await expect(window.getByTestId('activity-item-explorer')).toHaveCount(0);
  await expect(activityBarTrigger).toBeDisabled();
  await expect(activityBarTrigger).toHaveAttribute('aria-pressed', 'false');
  await expect(window.getByTestId('toggle-left-panel')).toBeDisabled();
  await expect(window.getByTestId('toggle-bottom-panel')).toBeDisabled();
  await expect(window.getByTestId('toggle-right-panel')).toBeDisabled();

  await window.getByLabel('Code').click();
  await expect(window.getByTestId('activity-item-explorer')).toBeVisible();
  await expect(window.getByTestId('code-view-factory')).toBeVisible();
  await expect(window.getByTestId('toggle-left-panel')).toBeDisabled();
  await expect(window.getByTestId('toggle-bottom-panel')).toBeDisabled();
  await expect(window.getByTestId('toggle-right-panel')).toBeDisabled();

  await window.getByTestId('activity-item-simulation').click();
  await expect(window.getByTestId('panel-simulation-left-panel')).toHaveCount(0);
  await expect(window.getByTestId('panel-simulation-bottom-panel')).toHaveCount(0);
  await expect(window.getByTestId('panel-simulation-right-panel')).toBeVisible();
  await expect(window.getByTestId('toggle-left-panel')).toBeEnabled();
  await expect(window.getByTestId('toggle-bottom-panel')).toBeEnabled();
  await expect(window.getByTestId('toggle-right-panel')).toBeEnabled();

  await window.getByTestId('activity-item-explorer').click();
  await expect(window.getByTestId('panel-center-panel')).toBeVisible();
  await expect(window.getByTestId('code-view-factory')).toHaveCount(0);
  await expect(window.getByTestId('panel-left-panel')).toHaveCount(0);
  await expect(window.getByTestId('panel-right-panel')).toHaveCount(0);

  await window.getByTestId('toggle-left-panel').click();
  await window.getByTestId('toggle-right-panel').click();
  await expect(window.getByTestId('panel-left-panel')).toBeVisible();
  await expect(window.getByTestId('panel-right-panel')).toBeVisible();

  await window.getByTestId('activity-item-simulation').click();
  await expect(window.getByTestId('panel-simulation-right-panel')).toBeVisible();

  await window.getByTestId('activity-item-explorer').click();
  await expect(window.getByTestId('panel-left-panel')).toBeVisible();
  await expect(window.getByTestId('panel-right-panel')).toBeVisible();

  await app.close();
});

test('status bar switches across primary and secondary navigation views', async () => {
  const { app, window } = await launchApp();

  const statusBar = window.getByTestId('status-bar');

  await expect(statusBar).toHaveAttribute('data-status-bar-id', 'code-explorer');

  await window.getByTestId('activity-item-simulation').click();
  await expect(window.getByTestId('code-view-simulation')).toBeVisible();
  await expect(statusBar).toHaveAttribute('data-status-bar-id', 'code-simulation');
  await expect(statusBar).toContainText('Simulation');
  await expect(statusBar).toContainText('Placeholder');

  await window.getByTestId('activity-item-physical').click();
  await expect(window.getByTestId('code-view-physical')).toBeVisible();
  await expect(statusBar).toHaveAttribute('data-status-bar-id', 'code-physical');
  await expect(statusBar).toContainText('Physical');

  await switchToWhiteboard(window);
  await expect(window.getByTestId('whiteboard-view')).toBeVisible();
  await expect(statusBar).toHaveAttribute('data-status-bar-id', 'whiteboard');
  await expect(statusBar).toContainText('Whiteboard');

  await window.getByLabel('Workflow').click();
  await expect(window.getByTestId('workflow-view')).toBeVisible();
  await expect(statusBar).toHaveAttribute('data-status-bar-id', 'workflow');
  await expect(statusBar).toContainText('Workflow');

  await window.getByLabel('Code').click();
  await expect(window.getByTestId('code-view-physical')).toBeVisible();
  await expect(statusBar).toHaveAttribute('data-status-bar-id', 'code-physical');

  await window.getByTestId('activity-item-explorer').click();
  await expect(window.getByTestId('panel-center-panel')).toBeVisible();
  await expect(statusBar).toHaveAttribute('data-status-bar-id', 'code-explorer');
  await expect(statusBar).toContainText('Ln 1, Col 1');

  await app.close();
});

test('left sidebar keeps a fixed pixel width across window changes and manual resize', async () => {
  test.slow();

  const { app, window } = await launchApp();
  const browserWindow = await app.browserWindow(window);
  await ensureExplorerVisible(window);
  const leftPanel = window.getByTestId('panel-left-panel');
  const leftHandle = window.getByTestId('panel-handle-left-panel');
  const readPanelWidth = async () => leftPanel.evaluate((element) => {
    const panelElement = element as { getBoundingClientRect?: () => { width: number } };
    return Math.round(panelElement.getBoundingClientRect?.().width ?? 0);
  });

  await expect(leftPanel).toBeVisible();
  await expect(leftHandle).toBeVisible();

  await expect.poll(readPanelWidth).toBeGreaterThanOrEqual(238);
  await expect.poll(readPanelWidth).toBeLessThanOrEqual(242);

  await browserWindow.evaluate((win) => win.setSize(1600, 900));

  await expect.poll(readPanelWidth).toBeGreaterThanOrEqual(238);
  await expect.poll(readPanelWidth).toBeLessThanOrEqual(242);

  await leftHandle.evaluate((element) => {
    const handle = element as {
      dispatchEvent: (event: unknown) => void;
      ownerDocument?: {
        defaultView?: {
          PointerEvent?: new (type: string, init?: Record<string, boolean | number>) => unknown;
        };
      };
    };
    const PointerEventCtor = handle.ownerDocument?.defaultView?.PointerEvent;

    if (!PointerEventCtor) {
      return;
    }

    handle.dispatchEvent(new PointerEventCtor('pointerdown', {
      bubbles: true,
      clientX: 240,
      pointerId: 1,
    }));
    handle.dispatchEvent(new PointerEventCtor('pointermove', {
      bubbles: true,
      clientX: 320,
      pointerId: 1,
    }));
    handle.dispatchEvent(new PointerEventCtor('pointerup', {
      bubbles: true,
      clientX: 320,
      pointerId: 1,
    }));
  });

  await expect.poll(readPanelWidth).toBeGreaterThanOrEqual(318);
  await expect.poll(readPanelWidth).toBeLessThanOrEqual(322);

  await browserWindow.evaluate((win) => win.setSize(1100, 900));

  await expect.poll(readPanelWidth).toBeGreaterThanOrEqual(318);
  await expect.poll(readPanelWidth).toBeLessThanOrEqual(322);

  await app.close();
});

test('activity bar shows compile and run action buttons with local selection only', async () => {
  const { app, window } = await launchApp();

  const compileButton = window.getByTestId('activity-action-compile');
  const runButton = window.getByTestId('activity-action-run');

  await expect(compileButton).toBeVisible();
  await expect(runButton).toBeVisible();
  await expect(window.getByTestId('activity-action-debug-action')).toHaveCount(0);

  await expect(compileButton).not.toHaveAttribute('aria-pressed', /.+/);
  await expect(runButton).not.toHaveAttribute('aria-pressed', /.+/);

  await runButton.click();
  await expect(compileButton).not.toHaveAttribute('aria-pressed', /.+/);
  await expect(runButton).not.toHaveAttribute('aria-pressed', /.+/);

  await app.close();
});

test('menu bar activity trigger expands and preserves the activity bar state across page switches', async () => {
  const { app, window } = await launchApp();

  const trigger = window.getByTestId('toggle-activity-bar');
  const physicalButton = window.getByTestId('activity-item-physical');
  const compileButton = window.getByTestId('activity-action-compile');
  const runButton = window.getByTestId('activity-action-run');

  await expect(trigger).toBeVisible();
  await expect(physicalButton.getByText('Physical')).toBeVisible();
  await expect(compileButton.getByText('Compile')).toHaveCount(0);

  await trigger.click();

  await expect(physicalButton.getByText('Physical')).toBeVisible();
  await expect(compileButton.getByText('Compile')).toBeVisible();
  await expect(runButton.getByText('Run')).toBeVisible();

  await switchToWhiteboard(window);
  await expect(window.getByTestId('whiteboard-view')).toBeVisible();
  await expect(window.getByTestId('activity-item-explorer')).toHaveCount(0);
  await expect(trigger).toBeVisible();

  await window.getByLabel('Code').click();
  await expect(window.getByTestId('activity-item-explorer')).toBeVisible();
  await expect(physicalButton.getByText('Physical')).toBeVisible();
  await expect(compileButton.getByText('Compile')).toBeVisible();

  await trigger.click();

  await expect(physicalButton.getByText('Physical')).toBeVisible();
  await expect(compileButton.getByText('Compile')).toHaveCount(0);
  await expect(runButton.getByText('Run')).toHaveCount(0);

  await app.close();
});

test('editor split actions create additional groups and support vertical splitting', async () => {
  const { app, window } = await launchApp();
  const editorGroups = window.locator('[data-testid^="editor-group-group-"]');

  await ensureExplorerVisible(window);
  await window.getByTestId('file-tree-node-README_md').click();
  await expect(window.getByTestId('editor-group-group-1')).toBeVisible();

  const firstGroup = window.getByTestId('editor-group-group-1');
  await firstGroup.getByTestId('editor-split-right').click();
  await expect(window.getByTestId('editor-group-group-2')).toBeVisible();
  await expect(editorGroups).toHaveCount(2);

  const secondGroup = window.getByTestId('editor-group-group-2');
  await secondGroup.getByTestId('editor-split-down').click();
  await expect(editorGroups).toHaveCount(3);

  await expect(firstGroup.getByTestId('editor-tab-README.md')).toBeVisible();
  await expect(secondGroup.getByTestId('editor-tab-README.md')).toBeVisible();
  await expect(editorGroups.nth(2).getByTestId('editor-tab-README.md')).toBeVisible();

  await app.close();
});

test('dragging one visible copy of the same file into a new split keeps the other rendered', async () => {
  const { app, window } = await launchApp();
  const editorGroups = window.locator('[data-testid^="editor-group-group-"]');

  await ensureExplorerVisible(window);
  await window.getByTestId('file-tree-node-README_md').click();

  const firstGroup = window.getByTestId('editor-group-group-1');
  await firstGroup.getByTestId('editor-split-right').click();

  const secondGroup = window.getByTestId('editor-group-group-2');
  await expect(secondGroup).toBeVisible();

  await expectVisibleEditorsToContainText(window, 2, 'Fixture Workspace');

  const secondGroupBounds = await secondGroup.boundingBox();
  if (!secondGroupBounds) {
    throw new Error('Expected second editor group bounds');
  }

  await secondGroup.getByTestId('editor-tab-README.md').dragTo(secondGroup, {
    targetPosition: {
      x: Math.max(Math.floor(secondGroupBounds.width / 2), 24),
      y: Math.max(Math.floor(secondGroupBounds.height - 18), 24),
    },
  });

  await expect(editorGroups).toHaveCount(3);
  await expectVisibleEditorsToContainText(window, 3, 'Fixture Workspace');

  await app.close();
});

test('focused split receives file tree opens and tabs can be dragged into another split', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await window.getByTestId('file-tree-node-README_md').click();

  const firstGroup = window.getByTestId('editor-group-group-1');
  await firstGroup.getByTestId('editor-split-right').click();

  const secondGroup = window.getByTestId('editor-group-group-2');
  await expect(secondGroup).toBeVisible();

  await firstGroup.click();
  await expect(firstGroup).toHaveAttribute('data-focused', 'true');

  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ]);

  await expect(firstGroup.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(secondGroup.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveCount(0);

  await firstGroup.getByTestId('editor-tab-rtl/core/reg_file.v').dragTo(secondGroup);

  await expect(firstGroup.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveCount(0);
  await expect(secondGroup.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();

  await app.close();
});

test('closing the last tab removes an empty split group', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await window.getByTestId('file-tree-node-README_md').click();

  const firstGroup = window.getByTestId('editor-group-group-1');
  await firstGroup.getByTestId('editor-split-right').click();

  await expect(window.getByTestId('editor-group-group-2')).toBeVisible();
  await firstGroup.getByTestId('editor-tab-close-README.md').click();

  await expect(window.getByTestId('editor-group-group-1')).toHaveCount(0);
  await expect(window.getByTestId('editor-group-group-2')).toBeVisible();

  await app.close();
});

test('ctrl+w closes the active tab when monaco focus is inside the current editor group', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await window.getByTestId('file-tree-node-README_md').dblclick();
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ], { finalAction: 'dblclick' });

  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveClass(/bg-background/);

  await focusMonacoEditor(window);
  await window.keyboard.press('Control+W');

  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveCount(0);
  await expect(window.getByTestId('editor-tab-README.md')).toHaveClass(/bg-background/);

  await app.close();
});

test('ctrl+tab cycles tabs to the right within the focused editor group', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await window.getByTestId('file-tree-node-README_md').dblclick();
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ], { finalAction: 'dblclick' });

  await window.keyboard.press('Control+P');
  const quickOpenInput = window.getByTestId('quick-open-input');
  await expect(quickOpenInput).toBeFocused();
  await quickOpenInput.fill('giti');
  await expect(window.getByTestId('quick-open-result-_gitignore')).toBeVisible();
  await quickOpenInput.press('Enter');

  await expect(window.getByTestId('editor-tab-.gitignore')).toBeVisible();
  await window.getByTestId('editor-tab-rtl/core/reg_file.v').click();
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveClass(/bg-background/);

  await focusMonacoEditor(window);
  await window.keyboard.press('Control+Tab');
  await expect(window.getByTestId('editor-tab-.gitignore')).toHaveClass(/bg-background/);
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).not.toHaveClass(/bg-background/);

  await window.keyboard.press('Control+Tab');
  await expect(window.getByTestId('editor-tab-README.md')).toHaveClass(/bg-background/);
  await expect(window.getByTestId('editor-tab-.gitignore')).not.toHaveClass(/bg-background/);

  await app.close();
});

test('ctrl+shift+tab cycles tabs to the left within the focused editor group', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await window.getByTestId('file-tree-node-README_md').dblclick();
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ], { finalAction: 'dblclick' });

  await window.keyboard.press('Control+P');
  const quickOpenInput = window.getByTestId('quick-open-input');
  await expect(quickOpenInput).toBeFocused();
  await quickOpenInput.fill('giti');
  await expect(window.getByTestId('quick-open-result-_gitignore')).toBeVisible();
  await quickOpenInput.press('Enter');

  await expect(window.getByTestId('editor-tab-.gitignore')).toHaveClass(/bg-background/);

  await focusMonacoEditor(window);
  await window.keyboard.press('Control+Shift+Tab');
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveClass(/bg-background/);
  await expect(window.getByTestId('editor-tab-.gitignore')).not.toHaveClass(/bg-background/);

  await window.getByTestId('editor-tab-README.md').click();
  await expect(window.getByTestId('editor-tab-README.md')).toHaveClass(/bg-background/);

  await focusMonacoEditor(window);
  await window.keyboard.press('Control+Shift+Tab');
  await expect(window.getByTestId('editor-tab-.gitignore')).toHaveClass(/bg-background/);
  await expect(window.getByTestId('editor-tab-README.md')).not.toHaveClass(/bg-background/);

  await app.close();
});

test('terminal tab creates a real shell session and shows command output', async () => {
  const { app, window } = await launchApp();
  const marker = '__PRISTINE_TERMINAL_E2E__';

  await openBottomTerminal(window);

  const terminalInput = window.locator('[data-testid="terminal-host"] .xterm-helper-textarea');
  await expect(terminalInput).toHaveCount(1);
  await terminalInput.click();
  await terminalInput.pressSequentially(`echo ${marker}`);
  await terminalInput.press('Enter');

  await expect.poll(async () => readTerminalText(window), {
    timeout: 15000,
  }).toContain(marker);

  await app.close();
});

test('terminal uses the shared theme and mono font at runtime', async () => {
  const { app, window } = await launchApp();

  await openBottomTerminal(window);
  await expect.poll(async () => readTerminalPid(window), {
    timeout: 15000,
  }).toBeGreaterThan(0);

  await expect.poll(async () => {
    const themeState = await readTerminalThemeSnapshot(window);

    return {
      hasBackground: Boolean(themeState.terminalBackground),
      hasFontFamilies: themeState.terminalFontFamilies.length > 0,
      hasExpectedBackground: Boolean(themeState.expectedBackground),
      backgroundMatches: themeState.terminalBackground === themeState.expectedBackground,
      usesJetBrainsMono: themeState.terminalFontFamilies.some((value) => value.toLowerCase().includes('jetbrains mono')),
    };
  }, {
    timeout: 15000,
  }).toEqual({
    hasBackground: true,
    hasFontFamilies: true,
    hasExpectedBackground: true,
    backgroundMatches: true,
    usesJetBrainsMono: true,
  });

  await window.getByRole('button', { name: /close panel/i }).click();
  await expect(window.getByTestId('terminal-host')).toHaveCount(0);

  await app.close();
});

test('terminal session survives tab switches and bottom panel hide/show', async () => {
  const { app, window } = await launchApp();
  const bottomPanel = window.getByTestId('panel-bottom-panel');

  await openBottomTerminal(window);

  await expect.poll(async () => readTerminalPid(window), {
    timeout: 15000,
  }).toBeGreaterThan(0);

  const originalPid = await readTerminalPid(window);
  expect(isProcessRunning(originalPid)).toBe(true);

  await bottomPanel.getByRole('button', { name: /^output$/i }).click();
  await expect(window.getByTestId('terminal-host')).toHaveCount(0);
  expect(isProcessRunning(originalPid)).toBe(true);

  await bottomPanel.getByRole('button', { name: /^terminal$/i, exact: true }).click();
  await expect.poll(async () => readTerminalPid(window), {
    timeout: 15000,
  }).toBe(originalPid);

  await window.getByTestId('toggle-bottom-panel').click();
  await expect(window.getByTestId('terminal-host')).toHaveCount(0);
  expect(isProcessRunning(originalPid)).toBe(true);

  await window.getByTestId('toggle-bottom-panel').click();
  await openBottomTerminal(window);
  await expect.poll(async () => readTerminalPid(window), {
    timeout: 15000,
  }).toBe(originalPid);

  await app.close();
});

test('terminal preserves output history across tab switches and bottom panel hide/show', async () => {
  const { app, window } = await launchApp();
  const bottomPanel = window.getByTestId('panel-bottom-panel');
  const marker = '__PRISTINE_TERMINAL_HISTORY__';

  await openBottomTerminal(window);

  const terminalInput = window.locator('[data-testid="terminal-host"] .xterm-helper-textarea');
  await expect(terminalInput).toHaveCount(1);
  await terminalInput.click();
  await terminalInput.pressSequentially(`echo ${marker}`);
  await terminalInput.press('Enter');

  await expect.poll(async () => readTerminalText(window), {
    timeout: 15000,
  }).toContain(marker);

  await bottomPanel.getByRole('button', { name: /^output$/i }).click();
  await expect(window.getByTestId('terminal-host')).toHaveCount(0);

  await window.getByTestId('toggle-bottom-panel').click();
  await expect(window.getByTestId('terminal-host')).toHaveCount(0);

  await window.getByTestId('toggle-bottom-panel').click();
  await bottomPanel.getByRole('button', { name: /^terminal$/i, exact: true }).click();
  await openBottomTerminal(window);

  await expect.poll(async () => readTerminalText(window), {
    timeout: 15000,
  }).toContain(marker);

  await app.close();
});

test('terminal bottom panel close button terminates the shell and reopening creates a new session', async () => {
  const { app, window } = await launchApp();

  await openBottomTerminal(window);

  await expect.poll(async () => readTerminalPid(window), {
    timeout: 15000,
  }).toBeGreaterThan(0);

  const originalPid = await readTerminalPid(window);
  expect(isProcessRunning(originalPid)).toBe(true);

  await window.getByRole('button', { name: 'Close Panel' }).click();
  await expect(window.getByTestId('terminal-host')).toHaveCount(0);

  await expect.poll(() => isProcessRunning(originalPid), {
    timeout: 15000,
  }).toBe(false);

  await window.getByTestId('toggle-bottom-panel').click();
  await openBottomTerminal(window);

  await expect.poll(async () => readTerminalPid(window), {
    timeout: 15000,
  }).toBeGreaterThan(0);

  const reopenedPid = await readTerminalPid(window);
  expect(reopenedPid).not.toBe(originalPid);
  expect(isProcessRunning(reopenedPid)).toBe(true);

  await window.getByRole('button', { name: 'Close Panel' }).click();
  await expect(window.getByTestId('terminal-host')).toHaveCount(0);

  await expect.poll(() => isProcessRunning(reopenedPid), {
    timeout: 15000,
  }).toBe(false);

  await app.close();
});

test('menu bar right-side controls render shadcn tooltip content at runtime', async () => {
  const { app, window } = await launchApp();

  const userAvatarButton = window.getByTestId('user-avatar-button');
  await expect(userAvatarButton).toBeVisible();

  await userAvatarButton.hover();
  await expect(window.getByRole('tooltip', { name: 'User profile' })).toBeVisible();

  await app.close();
});

test('floating info window stays visible after hiding the main window to tray', async () => {
  const { app, window } = await launchApp();
  const browserWindow = await app.browserWindow(window);

  await expect.poll(async () => browserWindow.evaluate((win) => win.isVisible())).toBe(true);

  await setFloatingInfoWindowVisibility(window, false);
  const existingFloatingInfoWindow = await getWindowByTitle(app, 'Pristine Floating Info');

  if (existingFloatingInfoWindow) {
    const existingFloatingBrowserWindow = await app.browserWindow(existingFloatingInfoWindow);
    await expect.poll(async () => existingFloatingBrowserWindow.evaluate((win) => win.isVisible())).toBe(false);
  }

  await window.getByTestId('menu-settings-button').click();
  await expect(window.getByTestId('settings-dialog')).toBeVisible();

  const closeToTraySwitch = window.getByTestId('settings-close-to-tray-switch');
  const floatingInfoSwitch = window.getByTestId('settings-floating-info-window-switch');

  await setSwitchChecked(closeToTraySwitch, false);
  await setSwitchChecked(closeToTraySwitch, true);
  await setSwitchChecked(floatingInfoSwitch, false);
  await setSwitchChecked(floatingInfoSwitch, true);

  await expect.poll(async () => readConfigValue(window, 'window.closeActionPreference')).toBe('tray');
  await expect.poll(async () => readConfigValue(window, 'ui.floatingInfoWindow.visible')).toBe(true);

  await window.getByTestId('settings-close-button').click();
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0);

  await expect.poll(async () => (await getWindowByTitle(app, 'Pristine Floating Info')) !== null).toBe(true);
  const floatingInfoWindow = await getWindowByTitle(app, 'Pristine Floating Info');

  if (!floatingInfoWindow) {
    throw new Error('Expected floating info window to be available');
  }

  await expect(floatingInfoWindow.getByTestId('floating-info-window')).toBeVisible();

  await window.getByTestId('window-control-close').click();

  await expect.poll(async () => browserWindow.evaluate((win) => win.isVisible())).toBe(false);
  await expect(floatingInfoWindow.getByTestId('floating-info-window')).toBeVisible();

  await setFloatingInfoWindowVisibility(window, false);
  await window.evaluate(async () => {
    const browserGlobal = globalThis as typeof globalThis & {
      electronAPI?: {
        config: {
          set: (key: string, value: unknown) => Promise<void>;
        };
      };
    };

    await browserGlobal.electronAPI?.config.set('window.closeActionPreference', null);
  });

  await app.close();
});

test('tray and floating info settings persist across app relaunch', async () => {
  const firstLaunch = await launchApp();
  const { app: firstApp, window: firstWindow } = firstLaunch;

  await clearRememberedCloseBehavior(firstWindow);
  await setFloatingInfoWindowVisibility(firstWindow, false);

  await firstWindow.getByTestId('menu-settings-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toBeVisible();

  await setSwitchChecked(firstWindow.getByTestId('settings-close-to-tray-switch'), false);
  await setSwitchChecked(firstWindow.getByTestId('settings-close-to-tray-switch'), true);
  await setSwitchChecked(firstWindow.getByTestId('settings-floating-info-window-switch'), true);

  await expect.poll(async () => readConfigValue(firstWindow, 'window.closeActionPreference')).toBe('tray');
  await expect.poll(async () => readConfigValue(firstWindow, 'ui.floatingInfoWindow.visible')).toBe(true);

  await firstWindow.getByTestId('settings-close-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toHaveCount(0);

  await firstApp.close();

  const secondLaunch = await launchApp();
  const { app: secondApp, window: secondWindow } = secondLaunch;

  await expect.poll(async () => (await getWindowByTitle(secondApp, 'Pristine Floating Info')) !== null).toBe(true);
  const floatingInfoWindow = await getWindowByTitle(secondApp, 'Pristine Floating Info');

  if (!floatingInfoWindow) {
    throw new Error('Expected floating info window after relaunch');
  }

  await expect(floatingInfoWindow.getByTestId('floating-info-window')).toBeVisible();

  await secondWindow.getByTestId('menu-settings-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toBeVisible();
  await expect(secondWindow.getByTestId('settings-close-to-tray-switch')).toHaveAttribute('data-state', 'checked');
  await expect(secondWindow.getByTestId('settings-floating-info-window-switch')).toHaveAttribute('data-state', 'checked');

  await setSwitchChecked(secondWindow.getByTestId('settings-floating-info-window-switch'), false);
  await setSwitchChecked(secondWindow.getByTestId('settings-close-to-tray-switch'), false);

  await expect.poll(async () => readConfigValue(secondWindow, 'ui.floatingInfoWindow.visible')).toBe(false);
  await expect.poll(async () => readConfigValue(secondWindow, 'window.closeActionPreference')).toBe('quit');

  await secondWindow.getByTestId('settings-close-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toHaveCount(0);

  await secondApp.close();
});

test('settings theme switch persists across app relaunch', async () => {
  test.slow();

  const readThemeSnapshot = async (page: Awaited<ReturnType<typeof launchApp>>['window']) => ({
    isDark: await page.evaluate(() => {
      const browserGlobal = globalThis as typeof globalThis & {
        document: {
          documentElement: {
            classList: {
              contains: (token: string) => boolean;
            };
          };
        };
      };

      return browserGlobal.document.documentElement.classList.contains('dark');
    }),
    stored: await readConfigValue(page, 'ui.theme'),
  });

  const firstLaunch = await launchApp();
  const { app: firstApp, window: firstWindow } = firstLaunch;

  await firstWindow.getByTestId('menu-settings-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toBeVisible();

  const firstThemeSwitch = firstWindow.getByTestId('settings-theme-switch');
  await setSwitchChecked(firstThemeSwitch, false);
  await setSwitchChecked(firstThemeSwitch, true);

  await expect.poll(async () => readThemeSnapshot(firstWindow)).toEqual({
    isDark: true,
    stored: 'dark',
  });

  await firstWindow.getByTestId('settings-close-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toHaveCount(0);

  await firstApp.close();

  const secondLaunch = await launchApp();
  const { app: secondApp, window: secondWindow } = secondLaunch;

  await expect.poll(async () => readThemeSnapshot(secondWindow)).toEqual({
    isDark: true,
    stored: 'dark',
  });

  await secondWindow.getByTestId('menu-settings-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toBeVisible();

  const secondThemeSwitch = secondWindow.getByTestId('settings-theme-switch');
  await expect(secondThemeSwitch).toHaveAttribute('data-state', 'checked');

  await setSwitchChecked(secondThemeSwitch, false);

  await expect.poll(async () => readThemeSnapshot(secondWindow)).toEqual({
    isDark: false,
    stored: 'light',
  });

  await secondWindow.getByTestId('settings-close-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toHaveCount(0);

  await secondApp.close();
});

test('code editor settings persist across app relaunch', async () => {
  test.slow();

  const firstLaunch = await launchApp();
  const { app: firstApp, window: firstWindow } = firstLaunch;

  await ensureExplorerVisible(firstWindow);
  await openNestedWorkspaceFile(firstWindow, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ]);
  await expect(firstWindow.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(firstWindow.locator('.monaco-editor .view-lines')).toContainText('module reg_file', {
    timeout: MONACO_READY_TIMEOUT_MS,
  });

  await firstWindow.getByTestId('menu-settings-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toBeVisible();

  await selectComboboxOption(
    firstWindow,
    'settings-editor-font-family-combobox',
    'settings-editor-font-family-option-monaspace-neon',
  );
  await selectComboboxOption(
    firstWindow,
    'settings-editor-theme-combobox',
    'settings-editor-theme-option-github-dark',
  );
  await setEditorFontSizePreset(firstWindow, 'max');

  await expect.poll(async () => readConfigValue(firstWindow, 'editor.fontFamily')).toBe('monaspace-neon');
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.theme')).toBe('github-dark');
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.fontSize')).toBe(24);
  await expect(firstWindow.getByTestId('settings-editor-font-family-combobox')).toContainText('Monaspace Neon');
  await expect(firstWindow.getByTestId('settings-editor-font-size-value')).toHaveText('24px');
  await expect(firstWindow.getByTestId('settings-editor-theme-combobox')).toContainText('GitHub Dark');

  await firstWindow.getByTestId('settings-close-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toHaveCount(0);

  await expect
    .poll(async () => {
      const snapshot = await readMonacoAppearanceSnapshot(firstWindow, {
        background: '#0d1117',
        lineNumber: '#8b949e',
      });

      return snapshot
        ? {
            fontFamilyIncludesSelection: snapshot.fontFamily.includes('Monaspace Neon'),
            fontSize: snapshot.fontSize,
            matchesBackground: snapshot.backgroundColor === snapshot.expectedBackgroundColor,
          }
        : null;
    })
    .toEqual({
      fontFamilyIncludesSelection: true,
      fontSize: '24px',
      matchesBackground: true,
    });

  await firstApp.close();

  const secondLaunch = await launchApp();
  const { app: secondApp, window: secondWindow } = secondLaunch;

  await ensureExplorerVisible(secondWindow);
  await openNestedWorkspaceFile(secondWindow, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ]);
  await expect(secondWindow.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(secondWindow.locator('.monaco-editor .view-lines')).toContainText('module reg_file', {
    timeout: MONACO_READY_TIMEOUT_MS,
  });

  await expect
    .poll(async () => {
      const snapshot = await readMonacoAppearanceSnapshot(secondWindow, {
        background: '#0d1117',
        lineNumber: '#8b949e',
      });

      return snapshot
        ? {
            fontFamilyIncludesSelection: snapshot.fontFamily.includes('Monaspace Neon'),
            fontSize: snapshot.fontSize,
            matchesBackground: snapshot.backgroundColor === snapshot.expectedBackgroundColor,
          }
        : null;
    })
    .toEqual({
      fontFamilyIncludesSelection: true,
      fontSize: '24px',
      matchesBackground: true,
    });

  await secondWindow.getByTestId('menu-settings-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toBeVisible();
  await expect(secondWindow.getByTestId('settings-editor-font-family-combobox')).toContainText('Monaspace Neon');
  await expect(secondWindow.getByTestId('settings-editor-font-size-value')).toHaveText('24px');
  await expect(secondWindow.getByTestId('settings-editor-theme-combobox')).toContainText('GitHub Dark');

  await selectComboboxOption(
    secondWindow,
    'settings-editor-font-family-combobox',
    'settings-editor-font-family-option-jetbrains-mono',
  );
  await setEditorFontSizePreset(secondWindow, 'min');
  await selectComboboxOption(
    secondWindow,
    'settings-editor-theme-combobox',
    'settings-editor-theme-option-github-light',
  );

  await expect.poll(async () => readConfigValue(secondWindow, 'editor.fontFamily')).toBe('jetbrains-mono');
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.fontSize')).toBe(10);
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.theme')).toBe('github-light');

  await secondWindow.getByTestId('settings-close-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toHaveCount(0);

  await expect
    .poll(async () => {
      const snapshot = await readMonacoAppearanceSnapshot(secondWindow, {
        background: '#ffffff',
        lineNumber: '#6e7781',
      });

      return snapshot
        ? {
            fontFamilyIncludesSelection: snapshot.fontFamily.includes('JetBrains Mono'),
            fontSize: snapshot.fontSize,
            matchesBackground: snapshot.backgroundColor === snapshot.expectedBackgroundColor,
          }
        : null;
    })
    .toEqual({
      fontFamilyIncludesSelection: true,
      fontSize: '10px',
      matchesBackground: true,
    });

  await secondApp.close();
});

test('editor font and theme comboboxes support wheel scrolling and reopen at the selected option', async () => {
  const { app, window } = await launchApp()

  await window.getByTestId('menu-settings-button').click()
  await expect(window.getByTestId('settings-dialog')).toBeVisible()

  await window.getByTestId('settings-editor-font-family-combobox').click()
  const fontList = window.locator('[data-combobox-list="settings-editor-font-family-combobox-list"]')
  await expect(fontList).toBeVisible()
  await fontList.hover()
  await window.mouse.wheel(0, 720)

  await expect.poll(async () => {
    const snapshot = await readComboboxListSnapshot(
      window,
      'settings-editor-font-family-combobox-list',
      'settings-editor-font-family-option-jetbrains-mono',
    )

    return snapshot?.scrollTop ?? 0
  }).toBeGreaterThan(0)

  await window.getByTestId('settings-editor-font-family-option-victor-mono').click()
  await expect(window.getByTestId('settings-editor-font-family-combobox')).toContainText('Victor Mono')

  await window.getByTestId('settings-editor-font-family-combobox').click()
  await expect.poll(async () => {
    return readComboboxListSnapshot(
      window,
      'settings-editor-font-family-combobox-list',
      'settings-editor-font-family-option-victor-mono',
    )
  }).toEqual(
    expect.objectContaining({
      selectedFullyVisible: true,
    }),
  )
  await window.keyboard.press('Escape')

  await selectComboboxOption(
    window,
    'settings-editor-theme-combobox',
    'settings-editor-theme-option-solarized-dark',
  )
  await expect(window.getByTestId('settings-editor-theme-combobox')).toContainText('Solarized Dark')

  await window.getByTestId('settings-editor-theme-combobox').click()
  const themeList = window.locator('[data-combobox-list="settings-editor-theme-combobox-list"]')
  await expect(themeList).toBeVisible()
  await themeList.hover()
  await window.mouse.wheel(0, 320)

  await expect.poll(async () => {
    return readComboboxListSnapshot(
      window,
      'settings-editor-theme-combobox-list',
      'settings-editor-theme-option-solarized-dark',
    )
  }).toEqual(
    expect.objectContaining({
      scrollHeight: expect.any(Number),
      clientHeight: expect.any(Number),
      selectedFullyVisible: true,
    }),
  )

  await window.keyboard.press('Escape')
  await app.close()
})

test('newly downloaded Monaco font options can be selected and persist to config', async () => {
  const { app, window } = await launchApp()

  await window.getByTestId('menu-settings-button').click()
  await expect(window.getByTestId('settings-dialog')).toBeVisible()

  await selectComboboxOption(
    window,
    'settings-editor-font-family-combobox',
    'settings-editor-font-family-option-0xproto',
  )

  await expect(window.getByTestId('settings-editor-font-family-combobox')).toContainText('0xProto')
  await expect.poll(async () => readConfigValue(window, 'editor.fontFamily')).toBe('0xproto')

  await app.close()
})

test('theme toggle persists across app relaunch', async () => {
  const firstLaunch = await launchApp();
  const { app: firstApp, window: firstWindow } = firstLaunch;

  const readThemeSnapshot = async (page: typeof firstWindow) => ({
    isDark: await page.evaluate(() => {
      const browserGlobal = globalThis as typeof globalThis & {
        document: {
          documentElement: {
            classList: {
              contains: (token: string) => boolean;
            };
          };
        };
      };

      return browserGlobal.document.documentElement.classList.contains('dark');
    }),
    stored: await readConfigValue(page, 'ui.theme'),
  });

  const initialTheme = await readThemeSnapshot(firstWindow);

  await firstWindow.getByTestId('toggle-theme').click();

  await expect.poll(async () => readThemeSnapshot(firstWindow)).not.toEqual(initialTheme);

  const toggledTheme = await readThemeSnapshot(firstWindow);

  await firstApp.close();

  const secondLaunch = await launchApp();
  const { app: secondApp, window: secondWindow } = secondLaunch;

  await expect.poll(async () => readThemeSnapshot(secondWindow)).toEqual(toggledTheme);

  if (toggledTheme.isDark !== initialTheme.isDark) {
    await secondWindow.getByTestId('toggle-theme').click();
    await expect.poll(async () => readThemeSnapshot(secondWindow)).toEqual(initialTheme);
  }

  await secondApp.close();
});

test('close button terminates the active terminal shell process', async () => {
  const { app, window } = await launchApp();

  await clearRememberedCloseBehavior(window);
  await openBottomTerminal(window);

  await expect.poll(async () => readTerminalPid(window), {
    timeout: 15000,
  }).toBeGreaterThan(0);

  const pid = await readTerminalPid(window);
  expect(isProcessRunning(pid)).toBe(true);

  const closePromise = window.waitForEvent('close');
  await requestWindowClose(window);
  await closePromise;

  await expect.poll(() => isProcessRunning(pid), {
    timeout: 15000,
  }).toBe(false);

  await expect.poll(() => app.windows().length).toBe(0);
  await app.close();
});

test('settings tray switch controls whether close hides to tray or quits', async () => {
  const { app, window } = await launchApp();
  const browserWindow = await app.browserWindow(window);

  await clearRememberedCloseBehavior(window);

  await window.getByTestId('menu-settings-button').click();
  await expect(window.getByTestId('settings-dialog')).toBeVisible();

  const closeToTraySwitch = window.getByTestId('settings-close-to-tray-switch');
  await expect(closeToTraySwitch).toHaveAttribute('data-state', 'unchecked');

  await closeToTraySwitch.click();
  await expect.poll(async () => readConfigValue(window, 'window.closeActionPreference')).toBe('tray');

  await window.getByTestId('settings-close-button').click();
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0);

  await requestWindowClose(window);
  await expect.poll(async () => browserWindow.evaluate((win) => win.isVisible())).toBe(false);

  await browserWindow.evaluate((win) => {
    win.show();
    win.focus();
  });

  await expect.poll(async () => browserWindow.evaluate((win) => win.isVisible())).toBe(true);

  await window.getByTestId('menu-settings-button').click();
  await expect(window.getByTestId('settings-dialog')).toBeVisible();
  await expect(closeToTraySwitch).toHaveAttribute('data-state', 'checked');
  await closeToTraySwitch.click();
  await expect.poll(async () => readConfigValue(window, 'window.closeActionPreference')).toBe('quit');

  await window.getByTestId('settings-close-button').click();
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0);

  const closePromise = window.waitForEvent('close');
  await requestWindowClose(window);
  await closePromise;

  await expect.poll(() => app.windows().length).toBe(0);
  await app.close();
});
