import { test, expect, _electron as electron, type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ASSISTANT_THREAD_LIST_DEFAULT_WIDTH_PX,
  ASSISTANT_THREAD_LIST_RESIZE_HANDLE_WIDTH_PX,
} from '../src/app/components/code/explorer/assistantPanelLayout';
import { waveformCanvasMinHeight } from '../src/app/components/code/explorer/waveform/waveformLayout';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureWorkspace = path.join(__dirname, '..', 'test', 'fixtures', 'workspace');
const releaseRoot = path.join(__dirname, '..', 'release');
const pristineEngineBinaryPath = path.join(
  __dirname,
  '..',
  'binaries',
  process.platform === 'win32' ? 'pristine-engine.exe' : 'pristine-engine',
);
const MONACO_READY_TIMEOUT_MS = 60000;
const UI_READY_TIMEOUT_MS = 60000;
type SettingsPageId = 'general' | 'appearance' | 'editor' | 'schematic' | 'window';

function normalizeComparableMonospaceFontFamily(fontFamily: string) {
  const tokens = fontFamily
    .split(',')
    .map((token) => token.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
    .filter(Boolean);
  const normalizedTokens: string[] = [];

  for (const token of tokens) {
    normalizedTokens.push(token);
    if (token === 'monospace') {
      break;
    }
  }

  return normalizedTokens.join(', ');
}

async function closeInlineGitDiffDetail(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const detail = window.getByTestId('monaco-inline-git-diff-detail');

  if ((await detail.count()) === 0) {
    return;
  }

  await window.keyboard.press('Escape');

  try {
    await expect(detail).toHaveCount(0, { timeout: 2000 });
    return;
  } catch {
    const closeButton = window.getByTestId('monaco-inline-git-diff-detail-close').first();

    if ((await closeButton.count()) > 0) {
      await closeButton.click({ force: true });
    }
  }

  await expect(detail).toHaveCount(0, { timeout: MONACO_READY_TIMEOUT_MS });
}

function createTerminalScrollFloodCommand(markerPrefix: string, count: number) {
  if (process.platform === 'win32') {
    return `1..${count} | ForEach-Object { "${markerPrefix}$_" }`;
  }

  return `i=1; while [ $i -le ${count} ]; do echo "${markerPrefix}$i"; i=$((i + 1)); done`;
}

function getE2EUserDataPath() {
  return test.info().outputPath('electron-user-data');
}

function skipIfPristineEngineUnavailable() {
  test.skip(
    !fs.existsSync(pristineEngineBinaryPath),
    `Pristine Engine binary is missing at ${pristineEngineBinaryPath}. Run "pnpm run prepare:pristine-engine" or "pnpm build" before this E2E test.`,
  );
}

interface ExpectedModuleHierarchyNode {
  instanceName?: string;
  moduleName: string;
}

async function waitForModuleHierarchyNodes(window: Page, expectedNodes: ExpectedModuleHierarchyNode[]) {
  await expect.poll(async () => window.evaluate(async ({ nodes }) => {
    interface BrowserHierarchyNode {
      children?: BrowserHierarchyNode[];
      instanceName?: string;
      moduleName: string;
    }

    interface BrowserModuleHierarchy {
      roots?: BrowserHierarchyNode[];
    }

    const browserGlobal = globalThis as typeof globalThis & {
      electronAPI?: {
        lsp?: {
          moduleHierarchy?: (options?: { maxDepth?: number }) => Promise<BrowserModuleHierarchy>;
        };
      };
    };
    const getNodeKey = (node: { instanceName?: string; moduleName: string }) => `${node.moduleName}:${node.instanceName ?? 'root'}`;

    try {
      const hierarchy = await browserGlobal.electronAPI?.lsp?.moduleHierarchy?.({ maxDepth: 64 });
      const foundKeys = new Set<string>();
      const visitNode = (node: BrowserHierarchyNode) => {
        foundKeys.add(getNodeKey(node));
        for (const child of node.children ?? []) {
          visitNode(child);
        }
      };

      for (const root of hierarchy?.roots ?? []) {
        visitNode(root);
      }

      return {
        foundKeys: Array.from(foundKeys).sort(),
        ready: nodes.every((node) => foundKeys.has(getNodeKey(node))),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        foundKeys: [],
        ready: false,
      };
    }
  }, { nodes: expectedNodes }), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toMatchObject({ ready: true });
}

interface E2EStoredAuthSession {
  accessToken: string;
  profile: {
    avatarUrl: string | null;
    email: string;
    sessionExpiresAt: number | null;
    syncedAt: string | null;
    userId: string;
    username: string;
  };
  refreshToken: string;
}

function createE2EStoredAuthSession(overrides: Partial<E2EStoredAuthSession> = {}): E2EStoredAuthSession {
  const baseSession: E2EStoredAuthSession = {
    accessToken: 'e2e-access-token',
    profile: {
      avatarUrl: null,
      email: 'alice@example.com',
      sessionExpiresAt: 1_600_000_000,
      syncedAt: null,
      userId: 'user-1',
      username: 'Alice',
    },
    refreshToken: 'e2e-refresh-token',
  };

  return {
    ...baseSession,
    ...overrides,
    profile: {
      ...baseSession.profile,
      ...overrides.profile,
    },
  };
}

function writeE2EAuthSession(session: E2EStoredAuthSession) {
  const userDataPath = getE2EUserDataPath();
  const authSessionPath = path.join(userDataPath, 'auth-session.json');
  const envelope = {
    encrypted: false,
    payload: Buffer.from(JSON.stringify(session), 'utf-8').toString('base64'),
  };

  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(authSessionPath, JSON.stringify(envelope, null, 2), 'utf-8');
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
  await window.waitForLoadState('domcontentloaded', { timeout: UI_READY_TIMEOUT_MS });
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
    timeout: UI_READY_TIMEOUT_MS,
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

async function launchApp(options?: { env?: Record<string, string | undefined>; projectRoot?: string }) {
  const app = await electron.launch({
    args: [path.join(__dirname, '..', 'dist-electron', 'main.js')],
    env: {
      ...process.env,
      ...options?.env,
      PRISTINE_E2E: '1',
      PRISTINE_PROJECT_ROOT: options?.projectRoot ?? fixtureWorkspace,
      PRISTINE_USER_DATA_PATH: getE2EUserDataPath(),
    },
  });

  const { splashWindow, window } = await resolveStartupWindows(app);
  await waitForMainUi(window);

  return { app, window, splashWindow };
}

async function setNextSaveDialogPath(
  app: Awaited<ReturnType<typeof electron.launch>>,
  filePath: string,
) {
  await app.evaluate(({ app: electronApp }, nextFilePath) => {
    void electronApp;
    process.env['PRISTINE_E2E_SAVE_DIALOG_PATH'] = nextFilePath;
  }, filePath);
}

function createWorkspaceCopy(targetPath: string) {
  fs.rmSync(targetPath, { recursive: true, force: true });
  fs.cpSync(fixtureWorkspace, targetPath, { recursive: true });
}

function createWorkspaceCopyWithFiles(targetName: string, files: Record<string, string>) {
  const targetPath = test.info().outputPath(targetName);

  createWorkspaceCopy(targetPath);

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(targetPath, relativePath);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf-8');
  }

  return targetPath;
}

function initializeGitWorkspaceCopy(targetPath: string, branchName: string) {
  const gitIgnorePath = path.join(targetPath, '.gitignore');
  const existingGitIgnore = fs.existsSync(gitIgnorePath)
    ? fs.readFileSync(gitIgnorePath, 'utf-8').trimEnd()
    : '';
  const nextGitIgnore = [existingGitIgnore, 'ignored-dir/', 'ignored.log']
    .filter(Boolean)
    .join('\n');

  fs.writeFileSync(gitIgnorePath, `${nextGitIgnore}\n`, 'utf-8');

  execFileSync('git', ['init'], { cwd: targetPath, stdio: 'pipe', windowsHide: true });
  execFileSync('git', ['config', 'user.name', 'Pristine E2E'], { cwd: targetPath, stdio: 'pipe', windowsHide: true });
  execFileSync('git', ['config', 'user.email', 'pristine-e2e@example.com'], { cwd: targetPath, stdio: 'pipe', windowsHide: true });
  execFileSync('git', ['add', '.'], { cwd: targetPath, stdio: 'pipe', windowsHide: true });
  execFileSync('git', ['commit', '-m', 'Initial fixture'], { cwd: targetPath, stdio: 'pipe', windowsHide: true });
  execFileSync('git', ['branch', '-M', branchName], { cwd: targetPath, stdio: 'pipe', windowsHide: true });

  fs.appendFileSync(path.join(targetPath, 'rtl', 'core', 'reg_file.v'), '\n// git modified fixture\n', 'utf-8');
  fs.mkdirSync(path.join(targetPath, 'ignored-dir'), { recursive: true });
  fs.writeFileSync(path.join(targetPath, 'ignored-dir', 'cache.txt'), 'ignored cache\n', 'utf-8');
  fs.writeFileSync(path.join(targetPath, 'ignored.log'), 'ignored log\n', 'utf-8');
}

function notifyAppWindowFocused(
  app: Awaited<ReturnType<typeof electron.launch>>,
) {
  return app.evaluate(async ({ BrowserWindow }) => {
    const mainWindow = BrowserWindow.getAllWindows().find((window) => window.getTitle() === 'Pristine');

    if (!mainWindow) {
      throw new Error('Expected Pristine main window');
    }

    mainWindow.webContents.send('stream:window:focus');
  });
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

function toWorkspaceTreeTestId(relativePath: string) {
  return `file-tree-node-${relativePath.replace(/[/.]/g, '_').replace(/[^A-Za-z0-9_-]/g, '-')}`;
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

async function ensureRightPanelVisible(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const rightPanel = window.getByTestId('panel-right-panel');

  if (await rightPanel.count() === 0 || !(await rightPanel.isVisible())) {
    await window.getByTestId('toggle-right-panel').click();
  }

  await expect(rightPanel).toBeVisible();
}

async function expectPanelHeaderWithoutDivider(header: Locator) {
  await expect(header).toBeVisible();
  await expect(header).not.toHaveClass(/(?:^|\s)border(?:\s|$)/);
  await expect(header).not.toHaveClass(/(?:^|\s)border-b(?:\s|$)/);
  await expect(header).not.toHaveClass(/(?:^|\s)border-ide-border(?:\s|$)/);
}

async function expectCollapsedPanel(panel: Locator) {
  await expect(panel).toHaveAttribute('aria-hidden', 'true');
  const collapsedState = await panel.getAttribute('data-collapsed');

  if (collapsedState !== null) {
    expect(collapsedState).toBe('true');
    await expect(panel).toHaveClass(/(?:^|\s)pointer-events-none(?:\s|$)/);
    return;
  }

  await expect(panel).not.toBeVisible();
}

async function readElementPixelWidth(locator: Locator) {
  return locator.evaluate((element) => {
    const node = element as { getBoundingClientRect?: () => { width: number } };
    return Math.round(node.getBoundingClientRect?.().width ?? 0);
  });
}

async function readElementPixelHeight(locator: Locator) {
  return locator.evaluate((element) => {
    const node = element as { getBoundingClientRect?: () => { height: number } };
    return Math.round(node.getBoundingClientRect?.().height ?? 0);
  });
}

async function readComputedTextColor(locator: Locator) {
  return locator.evaluate((element) => {
    const browserGlobal = globalThis as typeof globalThis & {
      getComputedStyle: (node: unknown) => { color: string };
    };

    return browserGlobal.getComputedStyle(element).color;
  });
}

async function readSearchInputVisualState(locator: Locator) {
  return locator.evaluate((element) => {
    type StyleLike = {
      backgroundColor: string;
      caretColor: string;
      color: string;
      getPropertyValue: (name: string) => string;
    };
    const browserGlobal = globalThis as typeof globalThis & {
      getComputedStyle: (node: unknown) => StyleLike;
    };
    const style = browserGlobal.getComputedStyle(element);

    return {
      backgroundColor: style.backgroundColor,
      caretColor: style.caretColor,
      color: style.color,
      webkitTextFillColor: style.getPropertyValue('-webkit-text-fill-color'),
    };
  });
}

async function readNormalizedCssColorVariable(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  variableName: string,
) {
  return window.evaluate((name) => {
    type ElementLike = {
      remove: () => void;
      style: { color: string };
    };
    const browserGlobal = globalThis as typeof globalThis & {
      document: {
        body: { appendChild: (node: ElementLike) => void };
        createElement: (tagName: string) => ElementLike;
        documentElement: ElementLike;
      };
      getComputedStyle: (element: ElementLike) => { color: string; getPropertyValue: (name: string) => string };
    };

    const rootStyle = browserGlobal.getComputedStyle(browserGlobal.document.documentElement);
    const probe = browserGlobal.document.createElement('span');
    probe.style.color = rootStyle.getPropertyValue(name).trim();
    browserGlobal.document.body.appendChild(probe);
    const normalizedColor = browserGlobal.getComputedStyle(probe).color;
    probe.remove();
    return normalizedColor;
  }, variableName);
}

async function readVerticalPixelGap(upperLocator: Locator, lowerLocator: Locator) {
  const [upperBox, lowerBox] = await Promise.all([
    upperLocator.boundingBox(),
    lowerLocator.boundingBox(),
  ]);

  if (!upperBox || !lowerBox) {
    return NaN;
  }

  return Math.round(lowerBox.y - (upperBox.y + upperBox.height));
}

async function readEditorTabBarSpacingSnapshot(tabBar: Locator, firstTab: Locator, secondTab: Locator) {
  const [tabBarStyles, tabBarBox, firstTabBox, secondTabBox] = await Promise.all([
    tabBar.evaluate((element) => {
      const browserGlobal = globalThis as typeof globalThis & {
        getComputedStyle: (node: unknown) => {
          columnGap: string;
          paddingBottom: string;
          paddingTop: string;
        };
      };
      const style = browserGlobal.getComputedStyle(element);

      return {
        columnGap: style.columnGap,
        paddingBottom: style.paddingBottom,
        paddingTop: style.paddingTop,
      };
    }),
    tabBar.boundingBox(),
    firstTab.boundingBox(),
    secondTab.boundingBox(),
  ]);

  if (!tabBarBox || !firstTabBox || !secondTabBox) {
    return null;
  }

  return {
    ...tabBarStyles,
    heightDeltaPx: Math.round(tabBarBox.height - firstTabBox.height),
    horizontalGapPx: Math.round(secondTabBox.x - (firstTabBox.x + firstTabBox.width)),
  };
}

async function readEditorTabPaddingSnapshot(tab: Locator) {
  return tab.evaluate((element) => {
    const browserGlobal = globalThis as typeof globalThis & {
      getComputedStyle: (node: unknown) => {
        maxWidth: string;
        minWidth: string;
        paddingLeft: string;
        paddingRight: string;
      };
    };
    const style = browserGlobal.getComputedStyle(element);

    return {
      maxWidth: style.maxWidth,
      minWidth: style.minWidth,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
    };
  });
}

async function waitForElementPixelWidthBetween(locator: Locator, minWidth: number, maxWidth: number) {
  await expect.poll(() => readElementPixelWidth(locator)).toBeGreaterThanOrEqual(minWidth);
  await expect.poll(() => readElementPixelWidth(locator)).toBeLessThanOrEqual(maxWidth);

  return readElementPixelWidth(locator);
}

async function positionExplorerNodeNearBottom(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  targetTestId: string,
) {
  const explorerTree = window.locator('.explorer-tree-scrollbar');

  await explorerTree.evaluate((element, targetId) => {
    type RectLike = {
      bottom: number;
    };

    type ScrollTargetLike = {
      getBoundingClientRect: () => RectLike;
    };

    type ScrollContainerLike = {
      getBoundingClientRect: () => RectLike;
      querySelector: (selector: string) => ScrollTargetLike | null;
      scrollTop: number;
    };

    const scrollContainer = element as unknown as ScrollContainerLike;
    const targetNode = scrollContainer.querySelector(`[data-testid="${targetId}"]`);

    if (!targetNode) {
      throw new Error(`Expected explorer node ${targetId} in the tree`);
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const targetRect = targetNode.getBoundingClientRect();
    const desiredBottom = containerRect.bottom - 12;

    scrollContainer.scrollTop += targetRect.bottom - desiredBottom;
  }, targetTestId);

  await expect(window.getByTestId(targetTestId)).toBeVisible();
}

async function readExplorerTreeScrollTop(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const explorerTree = window.locator('.explorer-tree-scrollbar');

  return explorerTree.evaluate((element) => {
    type ScrollContainerLike = {
      scrollTop: number;
    };

    return Math.round((element as unknown as ScrollContainerLike).scrollTop);
  });
}

async function scrollExplorerTreeToBottom(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const explorerTree = window.locator('.explorer-tree-scrollbar');

  return explorerTree.evaluate((element) => {
    type ScrollContainerLike = {
      clientHeight: number;
      scrollHeight: number;
      scrollTop: number;
    };

    const scrollContainer = element as unknown as ScrollContainerLike;
    scrollContainer.scrollTop = scrollContainer.scrollHeight;

    return {
      clientHeight: Math.round(scrollContainer.clientHeight),
      scrollHeight: Math.round(scrollContainer.scrollHeight),
      scrollTop: Math.round(scrollContainer.scrollTop),
    };
  });
}

async function readExplorerNodeTop(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  targetTestId: string,
) {
  const targetNode = window.getByTestId(targetTestId);
  const targetBox = await targetNode.boundingBox();

  if (!targetBox) {
    throw new Error(`Expected explorer node ${targetTestId} geometry to be measurable`);
  }

  return Math.round(targetBox.y);
}

async function recordExplorerNodeTopTimeline(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  targetTestId: string,
  sampleCount = 45,
  delayMs = 16,
) {
  const explorerTree = window.locator('.explorer-tree-scrollbar');

  return explorerTree.evaluate(async (element, options) => {
    type RectLike = {
      y: number;
    };

    type ScrollTargetLike = {
      getBoundingClientRect: () => RectLike;
    };

    type ScrollContainerLike = {
      querySelector: (selector: string) => ScrollTargetLike | null;
    };

    const scrollContainer = element as unknown as ScrollContainerLike;
    const samples: number[] = [];

    for (let index = 0; index < options.sampleCount; index += 1) {
      const targetNode = scrollContainer.querySelector(`[data-testid="${options.targetTestId}"]`);

      if (!targetNode) {
        throw new Error(`Expected explorer node ${options.targetTestId} in the tree while recording motion`);
      }

      samples.push(Math.round(targetNode.getBoundingClientRect().y));
      await new Promise<void>((resolve) => {
        setTimeout(resolve, options.delayMs);
      });
    }

    return samples;
  }, { targetTestId, sampleCount, delayMs });
}

function countTimelineDirectionChanges(samples: number[]) {
  let lastDirection = 0;
  let directionChanges = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const delta = samples[index] - samples[index - 1];

    if (delta === 0) {
      continue;
    }

    const direction = Math.sign(delta);

    if (lastDirection !== 0 && direction !== lastDirection) {
      directionChanges += 1;
    }

    lastDirection = direction;
  }

  return directionChanges;
}

async function recordExplorerTreeScrollTopTimeline(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  sampleCount = 45,
  delayMs = 16,
) {
  const explorerTree = window.locator('.explorer-tree-scrollbar');

  return explorerTree.evaluate(async (element, options) => {
    type ScrollContainerLike = {
      scrollTop: number;
    };

    const scrollContainer = element as unknown as ScrollContainerLike;
    const samples: number[] = [];

    for (let index = 0; index < options.sampleCount; index += 1) {
      samples.push(Math.round(scrollContainer.scrollTop));
      await new Promise<void>((resolve) => {
        setTimeout(resolve, options.delayMs);
      });
    }

    return samples;
  }, { sampleCount, delayMs });
}

async function openExplorerRenameInput(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  explorerTree: Locator,
  targetNode: Locator,
  renameInputTestId: string,
) {
  const renameInput = window.getByTestId(renameInputTestId);

  await targetNode.click();
  await expect(targetNode).toHaveAttribute('data-selected', 'true');
  await explorerTree.focus();
  await expect(explorerTree).toBeFocused();
  await explorerTree.press('F2');

  try {
    await expect(renameInput).toBeVisible({ timeout: 2000 });
    return renameInput;
  } catch {
    await targetNode.click({ button: 'right' });
    const renameMenuItem = window.getByRole('menuitem', { name: 'Rename' });
    await expect(renameMenuItem).toBeVisible({ timeout: 2000 });
    await renameMenuItem.click();
    await expect(renameInput).toBeVisible({ timeout: 5000 });
    return renameInput;
  }
}

async function setExplorerRenameInputValue(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  renameInputTestId: string,
  nextValue: string,
) {
  const renameInput = window.getByTestId(renameInputTestId);

  await expect(renameInput).toBeVisible();
  try {
    await expect(renameInput).toBeFocused({ timeout: 1500 });
  } catch {
    await renameInput.focus();
    await expect(renameInput).toBeFocused();
  }

  // Drive the input directly so Windows Electron focus jitter cannot blur and
  // cancel the inline rename session between select-all and text entry.
  await renameInput.fill(nextValue);
  await expect(renameInput).toHaveValue(nextValue);
}

async function openBottomTerminal(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const toggleBottomPanel = window.getByTestId('toggle-bottom-panel');
  await expect(toggleBottomPanel).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  if ((await toggleBottomPanel.getAttribute('aria-pressed')) !== 'true') {
    await toggleBottomPanel.click();
  }

  const bottomPanel = window.getByTestId('panel-bottom-panel');
  await expect(bottomPanel).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  const terminalTab = bottomPanel.getByTestId('bottom-panel-tab-terminal');
  await expect(terminalTab).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  if ((await terminalTab.getAttribute('data-state')) !== 'on') {
    await terminalTab.click();
  }

  const terminalHost = window.getByTestId('terminal-host');
  await expect(terminalHost).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(window.locator('[data-testid="terminal-host"] .xterm')).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  return terminalHost;
}

async function waitForTerminalLayoutSettled(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const terminalHost = window.getByTestId('terminal-host');

  await expect(terminalHost).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(window.locator('[data-testid="terminal-host"] .xterm')).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(window.locator('[data-testid="terminal-host"] .xterm-helper-textarea')).toHaveCount(1);
  await expect.poll(async () => window.evaluate(async () => {
    type RectLike = {
      height: number;
      width: number;
    };
    type ElementLike = {
      getBoundingClientRect: () => RectLike;
      isConnected: boolean;
      querySelector: (selector: string) => ElementLike | null;
    };
    const browserGlobal = globalThis as unknown as {
      document: {
        querySelector: (selector: string) => ElementLike | null;
      };
      requestAnimationFrame: (callback: () => void) => number;
    };
    const isReady = () => {
      const host = browserGlobal.document.querySelector('[data-testid="terminal-host"]');
      const xterm = host?.querySelector('.xterm') ?? null;
      const textarea = host?.querySelector('.xterm-helper-textarea') ?? null;

      if (!host?.isConnected || !xterm?.isConnected || !textarea?.isConnected) {
        return false;
      }

      const rect = host.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    if (!isReady()) {
      return false;
    }

    await new Promise<void>((resolve) => {
      browserGlobal.requestAnimationFrame(() => browserGlobal.requestAnimationFrame(() => resolve()));
    });

    return isReady();
  }), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe(true);
}

async function writeTerminalCommand(window: Awaited<ReturnType<typeof launchApp>>['window'], command: string) {
  await waitForTerminalLayoutSettled(window);
  await expect.poll(async () => readTerminalSessionId(window), {
    timeout: UI_READY_TIMEOUT_MS,
  }).not.toBe('');

  const sessionId = await readTerminalSessionId(window);
  if (!sessionId) {
    throw new Error('Expected terminal session id to be available before writing a command.');
  }

  const didWrite = await window.evaluate(async ({ payload, sessionId }) => {
    const browserGlobal = globalThis as unknown as {
      electronAPI?: {
        terminal?: {
          write: (id: string, data: string) => Promise<boolean>;
        };
      };
    };
    const api = browserGlobal.electronAPI?.terminal;
    if (!api) {
      return false;
    }

    return api.write(sessionId, payload);
  }, { payload: `${command}\r`, sessionId });

  expect(didWrite).toBe(true);
}

function getBottomPanelTab(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  tabId: 'terminal' | 'output' | 'problems' | 'debug' | 'lsp' | 'schematic' | 'waveform',
) {
  return window.getByTestId(`bottom-panel-tab-${tabId}`);
}

async function expectCompactPanelTabButton(tabButton: Locator) {
  await expect(tabButton).toHaveClass(/(?:^|\s)h-7(?:\s|$)/);
  await expect(tabButton).toHaveClass(/(?:^|\s)w-7(?:\s|$)/);

  const icon = tabButton.locator('svg').first();

  await expect(icon).toHaveAttribute('width', '12');
  await expect(icon).toHaveAttribute('height', '12');
}

async function switchToWhiteboard(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const whiteboardTrigger = window.getByTestId('center-view-whiteboard');

  await expect(whiteboardTrigger).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await whiteboardTrigger.click();
  await expect(window.getByTestId('whiteboard-view')).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
}

async function waitForDeferredMainContentPrewarm(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  await expect(window.getByTestId('workflow-view')).toHaveAttribute('data-ready', 'true', { timeout: UI_READY_TIMEOUT_MS });
  await expect(window.getByTestId('whiteboard-view')).toHaveAttribute('data-ready', 'true', { timeout: UI_READY_TIMEOUT_MS });
}

async function expectNoDeferredMainContentLoading(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  await expect(window.getByText('Loading view...')).toHaveCount(0);
  await expect(window.getByText('Loading whiteboard...')).toHaveCount(0);
}

async function readTerminalText(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  return window.getByTestId('terminal-host').getAttribute('data-terminal-text');
}

async function readTerminalPid(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const value = await window.getByTestId('terminal-host').getAttribute('data-terminal-pid');
  return value ? Number(value) : NaN;
}

async function readTerminalSessionId(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  return (await window.getByTestId('terminal-host').getAttribute('data-terminal-session-id')) ?? '';
}

async function readScrollbarWidthSnapshot(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  return window.getByTestId('terminal-host').evaluate((host) => {
    const browserGlobal = globalThis as unknown as {
      document: {
        querySelector: (selectors: string) => unknown | null;
      };
      getComputedStyle: (element: unknown, pseudoElt?: string) => {
        backgroundColor: string;
        width: string;
      };
    };
    const terminalHost = host as {
      parentElement: unknown | null;
      querySelector: (selectors: string) => unknown | null;
    };
    const explorerTree = browserGlobal.document.querySelector('.explorer-tree-scrollbar');
    const terminalViewport = terminalHost.querySelector('.xterm-viewport');
    const terminalCustomScrollbar = terminalHost.querySelector('.xterm-scrollable-element > .scrollbar');
    const terminalCustomSlider = terminalHost.querySelector('.xterm-scrollable-element > .scrollbar > .slider');

    if (!explorerTree || !terminalViewport || !terminalCustomScrollbar || !terminalCustomSlider || !terminalHost.parentElement) {
      return {
        hasExplorerTree: Boolean(explorerTree),
        hasTerminalCustomScrollbar: Boolean(terminalCustomScrollbar),
        hasTerminalCustomSlider: Boolean(terminalCustomSlider),
        hasTerminalSurface: Boolean(terminalHost.parentElement),
        hasTerminalViewport: Boolean(terminalViewport),
        ready: false,
      };
    }

    const terminalSurfaceStyle = browserGlobal.getComputedStyle(terminalHost.parentElement);
    const terminalCustomScrollbarStyle = browserGlobal.getComputedStyle(terminalCustomScrollbar);

    return {
      explorerWidth: browserGlobal.getComputedStyle(explorerTree, '::-webkit-scrollbar').width,
      ready: true,
      terminalCustomScrollbarMatchesSurface: terminalCustomScrollbarStyle.backgroundColor === terminalSurfaceStyle.backgroundColor,
      terminalCustomScrollbarWidth: terminalCustomScrollbarStyle.width,
      terminalCustomSliderWidth: browserGlobal.getComputedStyle(terminalCustomSlider).width,
      terminalViewportWidth: browserGlobal.getComputedStyle(terminalViewport, '::-webkit-scrollbar').width,
    };
  });
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
    const expectedColor = 'var(--ide-terminal-bg)';
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
  expectedColors?: { background?: string; lineNumber?: string | string[] },
) {
  return window.evaluate(({ background, lineNumber }) => {
    type StyleLike = {
      backgroundColor: string;
      color: string;
      display: string;
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
    const lineNumberValues = Array.isArray(lineNumber)
      ? lineNumber
      : lineNumber
        ? [lineNumber]
        : [];

    const backgroundElement =
      editorRoot.querySelector('.monaco-editor-background') ??
      editorRoot.querySelector('.margin') ??
      editorRoot;
    const lineNumberElement =
      editorRoot.querySelector('.margin .line-numbers.active-line-number') ??
      editorRoot.querySelector('.line-numbers.active-line-number') ??
      editorRoot.querySelector('.margin .line-numbers') ??
      editorRoot.querySelector('.line-numbers');
    const textLayer =
      editorRoot.querySelector('.view-lines .view-line') ??
      editorRoot.querySelector('.view-lines') ??
      editorRoot;

    return {
      backgroundColor: browserGlobal.getComputedStyle(backgroundElement).backgroundColor,
      expectedBackgroundColor: resolveCssColor('backgroundColor', background),
      expectedLineNumberColors: lineNumberValues
        .map((value) => resolveCssColor('color', value))
        .filter((value): value is string => Boolean(value)),
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
  const activeEditorTab = window.locator('[data-testid^="editor-tab-"][data-active="true"]').first();

  if (await activeEditorTab.count() > 0) {
    await activeEditorTab.click();
  }

  try {
    await expect(editor).toBeVisible({ timeout: 15000 });
  } catch {
    const firstEditorTab = window.locator('[data-testid^="editor-tab-"]').first();
    if (await firstEditorTab.count() > 0) {
      await firstEditorTab.click();
    }

    await expect(editor).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
  }

  return editor;
}

async function waitForMonacoEditorTextFocus(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  await expect.poll(() => window.evaluate(() => {
    type ElementWithClosest = Element & {
      closest: (selectors: string) => Element | null;
    };

    const browserGlobal = globalThis as typeof globalThis & {
      document: {
        activeElement: ElementWithClosest | null;
      };
    };
    const activeElement = browserGlobal.document.activeElement;
    return Boolean(
      activeElement?.closest('.monaco-editor')
      && activeElement.closest('textarea.inputarea, .inputarea, .native-edit-context, textarea, [contenteditable="true"]'),
    );
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
  return window.getByTestId('status-bar').getByText(/^\d+:\d+$/);
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

async function readBrowserWindowBounds(
  app: Awaited<ReturnType<typeof electron.launch>>,
  window: Page,
) {
  const browserWindow = await app.browserWindow(window);
  return browserWindow.evaluate((targetWindow) => targetWindow.getBounds());
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

async function openSettingsPage(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  page: SettingsPageId,
) {
  await window.getByTestId(`settings-nav-${page}`).click();
  await expect(window.getByTestId(`settings-page-${page}`)).toBeVisible();
}

async function openAssistantModelSelector(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  await ensureExplorerVisible(window);
  await ensureRightPanelVisible(window);

  const aiTab = window.getByTestId('right-panel-tab-ai');
  if (await aiTab.count() > 0) {
    await aiTab.click();
  }

  const assistantPanel = window.getByTestId('assistant-panel-root');
  await expect(assistantPanel).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  const modelSelectorTrigger = assistantPanel.locator('[data-slot="model-selector-trigger"]').first();
  await expect(modelSelectorTrigger).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await modelSelectorTrigger.click();

  const searchInput = window.getByRole('textbox', { name: 'Search providers' });
  await expect(searchInput).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  return searchInput;
}

async function expectModelProviderLogoLoaded(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  providerName: string,
  expectedPath: string,
) {
  const logo = window.getByAltText(`${providerName} logo`).first();
  await expect(logo).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(logo).toHaveAttribute('src', expectedPath);

  await expect.poll(
    async () => logo.evaluate((element) => {
      const image = element as { complete?: boolean; naturalWidth?: number };
      return Boolean(image.complete && (image.naturalWidth ?? 0) > 0);
    }),
    { timeout: UI_READY_TIMEOUT_MS },
  ).toBe(true);
}

async function readWorkbenchChromeThemeSnapshot(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  return window.evaluate(() => {
    type StyleLike = {
      backgroundColor: string;
      borderBottomWidth: string;
      borderRightWidth: string;
      borderTopWidth: string;
      color: string;
      getPropertyValue: (name: string) => string;
    };
    type ElementLike = {
      remove: () => void;
      style: { color: string };
    };
    const browserGlobal = globalThis as typeof globalThis & {
      devicePixelRatio: number;
      document: {
        body: { appendChild: (node: ElementLike) => void };
        createElement: (tagName: string) => ElementLike;
        documentElement: ElementLike;
        querySelector: (selectors: string) => ElementLike | null;
      };
      getComputedStyle: (element: ElementLike) => StyleLike;
    };

    const root = browserGlobal.document.documentElement;
    const menuBar = browserGlobal.document.querySelector('[data-testid="menu-bar-root"]');
    const activityBarContainer = browserGlobal.document.querySelector('[data-testid="activity-bar"]');
    const activityBarSurface = browserGlobal.document.querySelector('[data-testid="activity-bar"] [data-slot="sidebar-inner"]');
    const statusBar = browserGlobal.document.querySelector('[data-testid="status-bar"]');

    if (!menuBar || !activityBarContainer || !activityBarSurface || !statusBar) {
      throw new Error('Workbench chrome elements were not found.');
    }

    const normalizeColor = (value: string) => {
      const probe = browserGlobal.document.createElement('span');
      probe.style.color = value;
      browserGlobal.document.body.appendChild(probe);
      const normalizedColor = browserGlobal.getComputedStyle(probe).color;
      probe.remove();
      return normalizedColor;
    };

    const rootStyle = browserGlobal.getComputedStyle(root);
    const readColorVariable = (name: string) => normalizeColor(rootStyle.getPropertyValue(name).trim());
    const menuStyle = browserGlobal.getComputedStyle(menuBar);
    const activityContainerStyle = browserGlobal.getComputedStyle(activityBarContainer);
    const activitySurfaceStyle = browserGlobal.getComputedStyle(activityBarSurface);
    const statusStyle = browserGlobal.getComputedStyle(statusBar);

    return {
      devicePixelRatio: browserGlobal.devicePixelRatio,
      activity: {
        backgroundColor: activitySurfaceStyle.backgroundColor,
        borderRightWidth: activityContainerStyle.borderRightWidth,
      },
      menu: {
        backgroundColor: menuStyle.backgroundColor,
        borderBottomWidth: menuStyle.borderBottomWidth,
      },
      status: {
        backgroundColor: statusStyle.backgroundColor,
        borderTopWidth: statusStyle.borderTopWidth,
        color: statusStyle.color,
      },
      variables: {
        activitybarBackground: readColorVariable('--ide-activitybar-bg'),
        menubarBackground: readColorVariable('--ide-menubar-bg'),
        statusbarBackground: readColorVariable('--ide-statusbar-bg'),
        statusbarForeground: readColorVariable('--ide-statusbar-fg'),
        unifiedChromeBackground: readColorVariable('--ide-unified-chrome-bg'),
        unifiedChromeForeground: readColorVariable('--ide-unified-chrome-fg'),
      },
    };
  });
}

function expectSingleDevicePixelBorder(borderWidth: string, devicePixelRatio: number) {
  const cssPixelWidth = Number.parseFloat(borderWidth);

  expect(cssPixelWidth).toBeGreaterThan(0);
  expect(cssPixelWidth * devicePixelRatio).toBeCloseTo(1, 2);
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

async function expectMenuShellAttribute(
  menuShell: Locator,
  attribute: 'data-expanded' | 'data-locked',
  value: boolean,
) {
  await expect(menuShell).toHaveAttribute(attribute, value ? 'true' : 'false', {
    timeout: UI_READY_TIMEOUT_MS,
  });
}

async function ensureApplicationMenuVisible(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const menuShell = window.getByTestId('menu-menubar-shell');
  const menuToggle = window.getByTestId('menu-menubar-toggle');
  const fileTrigger = window.locator('[data-slot="menubar-trigger"]').filter({ hasText: 'File' }).first();

  if (await fileTrigger.count() > 0 && await fileTrigger.isVisible().catch(() => false)) {
    return;
  }

  await expect(menuToggle).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  if ((await menuShell.getAttribute('data-locked')) !== 'true') {
    await menuToggle.click();
  }

  await expectMenuShellAttribute(menuShell, 'data-expanded', true);
  await expect(fileTrigger).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
}

async function selectMenuBarItem(
  window: Awaited<ReturnType<typeof launchApp>>['window'],
  menuLabel: string,
  itemLabel: string,
) {
  await ensureApplicationMenuVisible(window);

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
  test.slow();

  const { app, window } = await launchApp();

  const title = await window.title();
  expect(title).toContain('Pristine');

  await waitForMainUi(window);
  await window.getByTestId('toggle-left-panel').click();

  const mainContentStack = window.getByTestId('main-content-stack');
  const explorerPanel = window.getByTestId('panel-left-panel');
  await expect(explorerPanel).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(window.getByTestId('code-view-explorer')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');
  await expect(window.getByTestId('left-panel-header')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');
  await expect(explorerPanel).toHaveClass(/(?:^|\s)rounded-md(?:\s|$)/);
  await expect(explorerPanel).toHaveClass(/(?:^|\s)border(?:\s|$)/);
  await expectCompactPanelTabButton(window.getByTestId('left-panel-tab-explorer'));
  await expectCompactPanelTabButton(window.getByTestId('left-panel-tab-git'));
  await window.getByTestId('left-panel-tab-git').click();
  await expect(window.getByTestId('left-panel-git-placeholder')).toHaveText('No source control changes');
  await expect(mainContentStack).toBeVisible();

  await app.close();
});

test('left outline slot is now source control placeholder', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await expectCompactPanelTabButton(window.getByTestId('left-panel-tab-git'));
  await expect(window.getByRole('radio', { name: 'Source Control' })).toBeVisible();
  await window.getByTestId('left-panel-tab-git').click();

  await expect(window.getByTestId('left-panel-git-placeholder')).toHaveText('No source control changes');
  await expect(window.getByTestId('left-panel-tab-outline')).toHaveCount(0);

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
    timeout: 60000,
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

test('packaged Windows app loads model provider logos from relative app assets', async () => {
  test.skip(process.platform !== 'win32', 'Packaged provider logo E2E runs on Windows only');
  test.skip(!packagedWindowsExecutablePath, 'Run pnpm run package:win before executing packaged provider logo E2E');

  const { app, window } = await launchPackagedWindowsApp();

  try {
    const searchInput = await openAssistantModelSelector(window);
    await searchInput.fill('openrouter');

    await expectModelProviderLogoLoaded(window, 'OpenRouter', 'model-provider-logos/openrouter.svg');
  } finally {
    await app.close();
  }
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

test('application menu expands on hover and stays visible when locked', async () => {
  const { app, window } = await launchApp();

  const menuToggle = window.getByTestId('menu-menubar-toggle');
  const menuShell = window.getByTestId('menu-menubar-shell');
  const themeToggle = window.getByTestId('toggle-theme');
  const fileTrigger = () => window.locator('[data-slot="menubar-trigger"]').filter({ hasText: 'File' }).first();

  await expect(menuToggle).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(themeToggle).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await themeToggle.hover();
  await expectMenuShellAttribute(menuShell, 'data-expanded', false);
  await expect(fileTrigger()).toHaveCount(0, { timeout: UI_READY_TIMEOUT_MS });

  await menuToggle.hover();
  await expectMenuShellAttribute(menuShell, 'data-expanded', true);
  await expect(fileTrigger()).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  await fileTrigger().hover();
  await expectMenuShellAttribute(menuShell, 'data-expanded', true);

  await themeToggle.hover();
  await expectMenuShellAttribute(menuShell, 'data-expanded', false);
  await expect(window.locator('[data-slot="menubar-trigger"]').filter({ hasText: 'File' })).toHaveCount(0, {
    timeout: UI_READY_TIMEOUT_MS,
  });

  await menuToggle.click();
  await expectMenuShellAttribute(menuShell, 'data-locked', true);
  await expectMenuShellAttribute(menuShell, 'data-expanded', true);
  await expect(fileTrigger()).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  await themeToggle.hover();
  await expectMenuShellAttribute(menuShell, 'data-expanded', true);

  await menuToggle.click();
  await expectMenuShellAttribute(menuShell, 'data-locked', false);

  await themeToggle.hover();
  await expectMenuShellAttribute(menuShell, 'data-expanded', false);

  await app.close();
});

test('File > Setting... opens the settings dialog and updates persisted options', async () => {
  const { app, window } = await launchApp();

  await clearRememberedCloseBehavior(window);
  await selectMenuBarItem(window, 'File', 'Setting...');
  await expect(window.getByTestId('settings-dialog')).toBeVisible();
  await openSettingsPage(window, 'window');

  await setSwitchChecked(window.getByTestId('settings-close-to-tray-switch'), true);
  await expect.poll(async () => readConfigValue(window, 'window.closeActionPreference')).toBe('tray');

  await window.getByTestId('settings-close-button').click();
  await clearRememberedCloseBehavior(window);

  await app.close();
});

test('settings dialog supports subpage navigation and global search', async () => {
  const { app, window } = await launchApp();

  await window.getByTestId('menu-settings-button').click();
  await expect(window.getByTestId('settings-dialog')).toBeVisible();
  await expect(window.getByTestId('settings-nav-general')).toHaveAttribute('aria-current', 'page');
  await expect(window.getByTestId('settings-page-general')).toBeVisible();

  await openSettingsPage(window, 'appearance');
  await expect(window.getByTestId('settings-nav-appearance')).toHaveAttribute('aria-current', 'page');
  await expect(window.getByTestId('settings-theme-combobox')).toBeVisible();

  await openSettingsPage(window, 'editor');
  await expect(window.getByTestId('settings-nav-editor')).toHaveAttribute('aria-current', 'page');
  await expect(window.getByTestId('settings-editor-font-family-combobox')).toBeVisible();

  await openSettingsPage(window, 'schematic');
  await expect(window.getByTestId('settings-nav-schematic')).toHaveAttribute('aria-current', 'page');
  await expect(window.getByTestId('settings-schematic-grid-size-slider')).toBeVisible();
  await expect(window.getByTestId('settings-schematic-grid-size-value')).toHaveText(/\d+px/);
  await setSwitchChecked(window.getByTestId('settings-schematic-grid-switch'), false);
  await expect.poll(async () => readConfigValue(window, 'schematic.grid.enabled')).toBe(false);
  await setSwitchChecked(window.getByTestId('settings-schematic-grid-switch'), true);
  await expect.poll(async () => readConfigValue(window, 'schematic.grid.enabled')).toBe(true);

  await openSettingsPage(window, 'window');
  await expect(window.getByTestId('settings-nav-window')).toHaveAttribute('aria-current', 'page');
  await expect(window.getByTestId('settings-close-to-tray-switch')).toBeVisible();

  const searchInput = window.getByTestId('settings-search-input');
  const searchIcon = window.getByTestId('settings-search-icon');

  await expect(searchInput).toHaveAttribute('spellcheck', 'false');
  await expect(searchInput).toHaveAttribute('autocomplete', 'off');
  await expect(searchIcon).toHaveCSS('opacity', '1');
  await expect.poll(async () => {
    const iconBox = await window.getByTestId('settings-nav-general-icon').boundingBox();
    const labelBox = await window.getByTestId('settings-nav-general-label').boundingBox();

    if (!iconBox || !labelBox) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.abs((iconBox.y + iconBox.height) - (labelBox.y + labelBox.height));
  }).toBeLessThanOrEqual(2);

  await searchInput.fill('font');
  await expect(searchIcon).toHaveCSS('opacity', '0');

  const expectedSearchTextColor = await readNormalizedCssColorVariable(window, '--ide-text');
  const searchInputColors = await readSearchInputVisualState(searchInput);
  await expect(searchInput).toHaveClass(/pristine-command-search-input/);
  expect(searchInputColors.color).toBe(expectedSearchTextColor);
  expect(searchInputColors.color).not.toBe('rgb(0, 0, 0)');
  expect(searchInputColors.color).not.toBe('rgba(0, 0, 0, 0)');
  expect(searchInputColors.color).not.toBe(searchInputColors.backgroundColor);
  expect(searchInputColors.caretColor).toBe(searchInputColors.color);
  expect(searchInputColors.webkitTextFillColor).toBe(searchInputColors.color);

  await expect(window.getByTestId('settings-page-search')).toBeVisible();
  await expect(window.getByTestId('settings-search-results-editor')).toBeVisible();
  await expect(window.getByTestId('settings-editor-font-family-combobox')).toBeVisible();
  await expect(window.getByTestId('settings-editor-font-size-slider')).toBeVisible();

  await searchInput.fill('zzzzzz');
  await expect(searchIcon).toHaveCSS('opacity', '0');
  await expect(window.getByTestId('settings-search-empty-state')).toBeVisible();

  await window.getByTestId('settings-nav-general').click();
  await expect(searchInput).toHaveValue('');
  await expect(searchIcon).toHaveCSS('opacity', '1');
  await expect(window.getByTestId('settings-nav-general')).toHaveAttribute('aria-current', 'page');
  await expect(window.getByTestId('settings-page-general')).toBeVisible();

  await app.close();
});

test('File > Close hides the app to tray when close-to-tray is enabled', async () => {
  test.slow();

  const { app, window } = await launchApp();
  const browserWindow = await app.browserWindow(window);

  await clearRememberedCloseBehavior(window);
  await selectMenuBarItem(window, 'File', 'Setting...');
  await expect(window.getByTestId('settings-dialog')).toBeVisible();
  await openSettingsPage(window, 'window');
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
  test.slow();

  const { app, window } = await launchApp();
  const browserWindow = await app.browserWindow(window);
  const closeShortcut = process.platform === 'darwin' ? 'Meta+Q' : 'Control+Q';

  await clearRememberedCloseBehavior(window);
  await selectMenuBarItem(window, 'File', 'Setting...');
  await expect(window.getByTestId('settings-dialog')).toBeVisible();
  await openSettingsPage(window, 'window');
  await setSwitchChecked(window.getByTestId('settings-close-to-tray-switch'), true);
  await expect.poll(async () => readConfigValue(window, 'window.closeActionPreference')).toBe('tray');
  await window.getByTestId('settings-close-button').click();
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0);

  await window.bringToFront();
  const activityBarTrigger = window.getByTestId('toggle-activity-bar');
  await activityBarTrigger.focus();
  await expect(activityBarTrigger).toBeFocused();
  await window.keyboard.press(closeShortcut);

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
  test.slow();

  const { app, window } = await launchApp();
  const browserWindow = await app.browserWindow(window);

  await clearRememberedCloseBehavior(window);
  await window.getByTestId('menu-settings-button').click();
  await expect(window.getByTestId('settings-dialog')).toBeVisible();
  await openSettingsPage(window, 'window');
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
  test.slow();

  const { app, window } = await launchApp();
  const browserWindow = await app.browserWindow(window);
  const marker = '__PRISTINE_TRAY_TERMINAL__';

  await clearRememberedCloseBehavior(window);
  await window.getByTestId('menu-settings-button').click();
  await expect(window.getByTestId('settings-dialog')).toBeVisible();
  await openSettingsPage(window, 'window');
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
  await waitForMonacoEditor(window);
  await expect(window.locator('.monaco-editor .view-lines')).toContainText('Fixture Workspace', {
    timeout: MONACO_READY_TIMEOUT_MS,
  });

  await app.close();
});

test('pristine-engine lsp smoke resolves a cross-file definition and symbol references', async () => {
  test.slow();
  skipIfPristineEngineUnavailable();

  const { app, window } = await launchApp();
  const aluInstantiationLine = '  alu u_alu ();';
  const dataReadyDeclarationLine = '  logic data_ready;';
  const aluSource = [
    'module alu;',
    'endmodule',
  ].join('\n');
  const cpuTopSource = [
    'module cpu_top #(',
    '  parameter int Width = 8',
    ') (',
    '  input logic clk_i',
    ');',
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
  await waitForMonacoEditor(window);
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
      const definition = await browserGlobal.electronAPI?.lsp.definition('rtl/core/cpu_top.sv', 7, definitionCharacter);
      const references = await browserGlobal.electronAPI?.lsp.references('rtl/core/cpu_top.sv', 5, referencesCharacter, true);

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

  await ensureRightPanelVisible(window);
  await window.getByTestId('right-panel-tab-outline').click();
  await expect(window.getByTestId('outline-tree')).toBeVisible({ timeout: 15000 });
  await expect(window.getByTestId('outline-node-label-module-cpu_top')).toBeVisible();
  await expect(window.getByTestId('outline-kind-group-label-parameter')).toHaveText('Parameter');
  await expect(window.getByTestId('outline-kind-group-count-parameter')).toHaveText('(1)');
  await expect(window.getByTestId('outline-node-label-parameter-Width')).toBeVisible();
  await expect(window.getByTestId('outline-node-detail-parameter-Width')).toHaveText('int = 8');
  await expect(window.getByTestId('outline-kind-group-label-port')).toHaveText('Port');
  await expect(window.getByTestId('outline-kind-group-count-port')).toHaveText('(1)');
  await expect(window.getByTestId('outline-node-label-port-clk_i')).toBeVisible();
  await expect(window.getByTestId('outline-node-detail-port-clk_i')).toHaveText('input logic');
  const clkOutlineLabel = window.getByTestId('outline-node-label-port-clk_i');
  const clkOutlineLabelBox = await clkOutlineLabel.boundingBox();
  if (!clkOutlineLabelBox) {
    throw new Error('Expected clk_i outline label bounds.');
  }
  const outlineHoverPoint = {
    x: clkOutlineLabelBox.x + clkOutlineLabelBox.width / 2,
    y: clkOutlineLabelBox.y + clkOutlineLabelBox.height / 2,
  };
  await window.mouse.move(outlineHoverPoint.x, outlineHoverPoint.y);
  const outlineTooltip = window.getByRole('tooltip');
  await expect(outlineTooltip).toContainText('input logic');
  await expect.poll(async () => {
    const tooltipBox = await outlineTooltip.boundingBox();
    return tooltipBox ? tooltipBox.y > outlineHoverPoint.y : false;
  }).toBe(true);
  await expect(window.getByTestId('outline-kind-group-label-variable')).toHaveText('Variable');
  await expect(window.getByTestId('outline-node-label-variable-data_ready')).toBeVisible();
  await expect(window.getByTestId('outline-kind-group-label-instance')).toHaveText('Instance');
  await expect(window.getByTestId('outline-node-label-instance-u_alu')).toBeVisible();
  await expect(window.getByTestId('outline-node-detail-instance-u_alu')).toHaveText('alu');

  await window.getByTestId('outline-kind-group-variable').click();
  await expect(window.getByTestId('outline-node-label-variable-data_ready')).toHaveCount(0);
  await window.getByTestId('outline-kind-group-variable').click();
  await expect(window.getByTestId('outline-node-label-variable-data_ready')).toBeVisible();
  await window.getByTestId('outline-node-label-variable-data_ready').click();
  await expect(window.locator('.monaco-editor .line-numbers.active-line-number')).toContainText('6');

  await window.getByTestId('toggle-bottom-panel').click();
  await getBottomPanelTab(window, 'lsp').click();
  await expect(window.getByTestId('lsp-panel')).toContainText('systemverilog/outline', { timeout: 10000 });

  await app.close();
});

test('code view hierarchy renders module instantiations from pristine-engine', async () => {
  test.slow();
  skipIfPristineEngineUnavailable();

  const aluSource = [
    'module alu;',
    'endmodule',
  ].join('\n');
  const busInterfaceSource = [
    'interface bus_if;',
    'endinterface',
  ].join('\n');
  const cpuTopSource = [
    'module cpu_top;',
    '  alu u_alu ();',
    '  bus_if bus ();',
    '  missing_block u_missing ();',
    'endmodule',
  ].join('\n');
  const projectRoot = createWorkspaceCopyWithFiles('hierarchy-workspace', {
    'rtl/core/alu.sv': aluSource,
    'rtl/core/bus_if.sv': busInterfaceSource,
    'rtl/core/cpu_top.sv': cpuTopSource,
  });
  const { app, window } = await launchApp({ projectRoot });

  await ensureExplorerVisible(window);
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_cpu_top_sv',
  ]);

  await expect(window.getByTestId('editor-tab-rtl/core/cpu_top.sv')).toBeVisible();
  await waitForMonacoEditor(window);
  await expect(window.locator('.monaco-editor .view-lines')).toContainText('alu u_alu', {
    timeout: MONACO_READY_TIMEOUT_MS,
  });

  await waitForModuleHierarchyNodes(window, [
    { moduleName: 'cpu_top' },
    { instanceName: 'u_alu', moduleName: 'alu' },
    { instanceName: 'bus', moduleName: 'bus_if' },
    { instanceName: 'u_missing', moduleName: 'missing_block' },
  ]);

  await window.getByTestId('left-panel-split-toggle').click();
  await expect(window.getByTestId('left-panel-secondary-panel')).toBeVisible();
  await expect(window.getByTestId('left-panel-secondary-tab-hierarchy')).toBeVisible();
  await expect(window.getByTestId('left-panel-secondary-tab-libraries')).toBeVisible();
  await expect(
    window.getByTestId('left-panel-secondary-header').getByRole('button', { name: 'Reload module hierarchy' }),
  ).toBeVisible();

  await window.getByTestId('left-panel-secondary-tab-libraries').click();
  await expect(window.getByTestId('left-panel-libraries-placeholder')).toHaveText('Libraries is empty');
  await window.getByTestId('left-panel-secondary-tab-hierarchy').click();

  const topNode = window.getByTestId('hierarchy-node-label-cpu_top-root');
  const aluInstanceNode = window.getByTestId('hierarchy-node-label-alu-u_alu');
  const interfaceInstanceNode = window.getByTestId('hierarchy-node-label-bus_if-bus');

  await expect(topNode).toBeVisible({ timeout: 15000 });
  await expect(window.getByLabel('Automatic top module')).toBeVisible();

  await expect(aluInstanceNode).toBeVisible();
  await expect(aluInstanceNode).toHaveText('u_alu');
  await expect(aluInstanceNode).not.toContainText(': alu');
  await expect(interfaceInstanceNode).toBeVisible();
  await expect(interfaceInstanceNode).toHaveText('bus');
  const interfaceRow = interfaceInstanceNode.locator('xpath=ancestor::*[@role="treeitem"][1]');
  const interfaceIcon = interfaceRow.locator('[data-testid^="hierarchy-node-icon-"]');
  await expect(interfaceIcon).toHaveAccessibleName('Interface bus_if');
  await expect(interfaceIcon.locator('svg.lucide-ethernet-port')).toBeVisible();
  await interfaceInstanceNode.hover();
  const hierarchyTooltip = window.getByRole('tooltip', { name: 'rtl/core/bus_if.sv' });
  await expect(hierarchyTooltip).toBeVisible();
  const hierarchyTooltipSurface = window.getByTestId('hierarchy-node-tooltip');
  await expect(hierarchyTooltipSurface).toBeVisible();
  const tooltipBox = await hierarchyTooltipSurface.boundingBox();
  const labelBox = await interfaceInstanceNode.boundingBox();
  expect(tooltipBox).not.toBeNull();
  expect(labelBox).not.toBeNull();
  if (tooltipBox && labelBox) {
    expect(Math.abs(tooltipBox.x - labelBox.x)).toBeLessThanOrEqual(8);
    expect(tooltipBox.y).toBeGreaterThanOrEqual(labelBox.y + labelBox.height - 2);
  }
  await expect.poll(async () => hierarchyTooltipSurface.evaluate((element) => {
    const style = (globalThis as unknown as {
      getComputedStyle: (target: unknown) => {
        backgroundColor: string;
        borderBottomColor: string;
        borderBottomStyle: string;
        borderBottomWidth: string;
        opacity: string;
      };
    }).getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderBottomColor: style.borderBottomColor,
      borderBottomStyle: style.borderBottomStyle,
      borderBottomWidth: style.borderBottomWidth,
      opacity: style.opacity,
    };
  })).toMatchObject({
    borderBottomStyle: 'solid',
    opacity: '1',
  });
  await expect.poll(async () => hierarchyTooltipSurface.evaluate((element) => {
    const { backgroundColor, borderBottomColor, borderBottomWidth } = (globalThis as unknown as {
      getComputedStyle: (target: unknown) => {
        backgroundColor: string;
        borderBottomColor: string;
        borderBottomWidth: string;
      };
    }).getComputedStyle(element);
    return {
      hasOpaqueBackground: !backgroundColor.endsWith(', 0)') && backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0, 0, 0, 0)',
      hasBottomBorder: Number.parseFloat(borderBottomWidth) > 0,
      hasDistinctBorderColor: borderBottomColor !== 'transparent' && borderBottomColor !== 'rgba(0, 0, 0, 0)' && borderBottomColor !== backgroundColor,
    };
  })).toEqual({
    hasBottomBorder: true,
    hasDistinctBorderColor: true,
    hasOpaqueBackground: true,
  });
  await expect(window.getByLabel('Unresolved module missing_block')).toBeVisible();

  await window.getByRole('button', { name: 'Collapse cpu_top' }).click();
  await expect(aluInstanceNode).toHaveCount(0);
  await window.getByRole('button', { name: 'Expand cpu_top' }).click();
  await expect(aluInstanceNode).toBeVisible();

  await aluInstanceNode.dblclick();
  await expect(window.getByTestId('editor-tab-rtl/core/alu.sv')).toBeVisible();
  await waitForMonacoEditor(window);
  await expect(window.locator('.monaco-editor .view-lines')).toContainText('module alu', {
    timeout: MONACO_READY_TIMEOUT_MS,
  });

  await app.close();
});

test('lsp panel captures initialization logs when hierarchy opens before any editor', async () => {
  test.slow();
  skipIfPristineEngineUnavailable();

  const aluSource = [
    'module alu;',
    'endmodule',
  ].join('\n');
  const busInterfaceSource = [
    'interface bus_if;',
    'endinterface',
  ].join('\n');
  const cpuTopSource = [
    'module cpu_top;',
    '  alu u_alu ();',
    '  bus_if bus ();',
    'endmodule',
  ].join('\n');
  const projectRoot = createWorkspaceCopyWithFiles('hierarchy-lsp-log-workspace', {
    'rtl/core/alu.sv': aluSource,
    'rtl/core/bus_if.sv': busInterfaceSource,
    'rtl/core/cpu_top.sv': cpuTopSource,
  });
  const { app, window } = await launchApp({ projectRoot });

  await ensureExplorerVisible(window);
  await expect(window.getByTestId('editor-tab-rtl/core/cpu_top.sv')).toHaveCount(0);

  await window.getByTestId('left-panel-split-toggle').click();
  await expect(window.getByTestId('left-panel-secondary-panel')).toBeVisible();
  await window.getByTestId('left-panel-secondary-tab-hierarchy').click();
  await expect(window.getByTestId('hierarchy-node-label-cpu_top-root')).toBeVisible({ timeout: 15000 });

  await window.getByTestId('toggle-bottom-panel').click();
  await getBottomPanelTab(window, 'lsp').click();
  await expect(window.getByTestId('lsp-panel')).toBeVisible();

  await expect.poll(async () => window.getByTestId('lsp-panel').innerText(), {
    timeout: 15000,
  }).toContain('initialize');
  await expect(window.getByTestId('lsp-panel')).toContainText('systemverilog/moduleHierarchy');
  await expect(window.getByTestId('lsp-panel')).toContainText('Status: ready');

  await app.close();
});

test('lsp panel shows prewarmed initialization logs before any SystemVerilog file opens', async () => {
  test.slow();
  skipIfPristineEngineUnavailable();

  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await expect(window.getByTestId('editor-tab-rtl/core/cpu_top.sv')).toHaveCount(0);

  await window.getByTestId('toggle-bottom-panel').click();
  await getBottomPanelTab(window, 'lsp').click();
  await expect(window.getByTestId('lsp-panel')).toBeVisible();

  await expect.poll(async () => window.getByTestId('lsp-panel').innerText(), {
    timeout: 15000,
  }).toContain('initialize');
  await expect(window.getByTestId('lsp-panel')).toContainText('initialized');
  await expect(window.getByTestId('lsp-panel')).toContainText('Status: ready');
  await expect(window.getByTestId('lsp-panel')).not.toContainText('textDocument/didOpen');

  await app.close();
});

test('pristine-engine lsp bottom panel filters diagnostics and shows paired request responses', async () => {
  test.slow();
  skipIfPristineEngineUnavailable();

  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await expect(window.getByTestId('panel-left-panel').getByRole('button', { name: /^Problems$/i })).toHaveCount(0);
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_cpu_top_sv',
  ]);

  await expect(window.getByTestId('editor-tab-rtl/core/cpu_top.sv')).toBeVisible();
  await waitForMonacoEditor(window);
  await expect(window.locator('.monaco-editor .view-lines')).toContainText('alu u_alu', {
    timeout: MONACO_READY_TIMEOUT_MS,
  });

  await window.getByTestId('toggle-bottom-panel').click();
  await getBottomPanelTab(window, 'lsp').click();

  await expect(window.getByTestId('lsp-panel')).toBeVisible();

  await expect.poll(async () => window.evaluate(async () => {
    const browserGlobal = globalThis as typeof globalThis & {
      electronAPI?: {
        lsp: {
          definition: (filePath: string, line: number, character: number) => Promise<Array<{ filePath: string }>>;
        };
      };
    };

    try {
      const definition = await browserGlobal.electronAPI?.lsp.definition('rtl/core/cpu_top.sv', 3, 2);
      return definition?.[0]?.filePath ?? null;
    } catch {
      return null;
    }
  }), {
    timeout: 15000,
  }).toBe('rtl/core/alu.sv');

  await expect.poll(async () => window.getByTestId('lsp-event-item').count(), {
    timeout: 15000,
  }).toBeGreaterThan(0);

  await expect.poll(async () => {
    const errorCount = Number(await window.getByTestId('status-bar-error-count').textContent() ?? '0');
    const warningCount = Number(await window.getByTestId('status-bar-warning-count').textContent() ?? '0');
    return errorCount + warningCount;
  }, {
    timeout: 15000,
  }).toBeGreaterThan(0);

  const problemsTab = getBottomPanelTab(window, 'problems');
  await expect(problemsTab).toBeVisible();
  await problemsTab.click();
  await expect(window.locator('text=/Errors|Warnings|Infos|Hints/').first()).toBeVisible();

  await getBottomPanelTab(window, 'lsp').click();
  await expect(window.getByTestId('lsp-panel')).toContainText(/initialize|textDocument\/definition|textDocument\/didOpen/);

  await window.getByTestId('lsp-filter-diagnostic').click();
  await expect(window.getByRole('button', { name: /textDocument\/publishDiagnostics/i }).first()).toBeVisible();
  await expect(window.getByRole('button', { name: /textDocument\/definition/i })).toHaveCount(0);

  await window.getByTestId('lsp-filter-response').click();
  const definitionEntry = window.getByRole('button', { name: /textDocument\/definition/i });
  await expect(definitionEntry).toBeVisible();
  await definitionEntry.click();
  await expect(window.getByText('Request payload')).toBeVisible();
  await expect(window.getByText('Response payload')).toBeVisible();

  await window.getByTestId('editor-tab-close-rtl/core/cpu_top.sv').click();
  await expect(window.getByTestId('editor-tab-rtl/core/cpu_top.sv')).toHaveCount(0);
  await expect(window.getByTestId('status-bar-error-count')).toHaveText('0');
  await expect(window.getByTestId('status-bar-warning-count')).toHaveText('0');

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
  await expect(window.getByTestId('editor-tab-preview-indicator-ring-README.md')).toHaveCount(1);
  await expect(window.getByTestId('editor-tab-preview-indicator-dot-README.md')).toHaveCount(1);

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

test('Monaco editor accepts literal spaces', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('monaco-space-workspace');
  createWorkspaceCopy(workspaceCopy);

  const filePath = path.join(workspaceCopy, 'rtl', 'core', 'reg_file.v');
  const markerLeft = `pristine_space_left_${Date.now()}`;
  const markerRight = `pristine_space_right_${Date.now()}`;
  const markerWithSpace = `${markerLeft} ${markerRight}`;
  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await openNestedWorkspaceFile(window, [
      'file-tree-node-rtl',
      'file-tree-node-rtl_core',
      'file-tree-node-rtl_core_reg_file_v',
    ]);

    await waitForMonacoEditor(window);
    await focusMonacoEditor(window);
    await waitForMonacoEditorTextFocus(window);
    await window.keyboard.press('Control+End');
    await window.keyboard.type(`\n${markerLeft}`);
    await window.keyboard.press('Space');
    await window.keyboard.type(markerRight);

    await expect(window.getByTestId('editor-tab-dirty-indicator-rtl/core/reg_file.v')).toBeVisible();
    await window.keyboard.press('Control+S');

    await expect.poll(() => fs.readFileSync(filePath, 'utf-8'), {
      timeout: 15000,
    }).toContain(markerWithSpace);
  } finally {
    await app.close();
  }
});

test('ctrl+s saves an edited explorer file and clears the dirty indicator', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('save-workspace');
  createWorkspaceCopy(workspaceCopy);

  const filePath = path.join(workspaceCopy, 'rtl', 'core', 'reg_file.v');
  const marker = `//e2e-save-marker-${Date.now()}`;
  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await openNestedWorkspaceFile(window, [
      'file-tree-node-rtl',
      'file-tree-node-rtl_core',
      'file-tree-node-rtl_core_reg_file_v',
    ]);

    await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
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

test('workflow and whiteboard switch without a loading state after deferred prewarm completes', async () => {
  const { app, window } = await launchApp();

  try {
    await waitForMainUi(window);
    await waitForDeferredMainContentPrewarm(window);
    await expect(window.getByTestId('workflow-view')).toHaveAttribute('data-active', 'false');
    await expect(window.getByTestId('whiteboard-view')).toHaveAttribute('data-active', 'false');
    await expectNoDeferredMainContentLoading(window);

    await window.getByLabel('Workflow').click();
    await expect(window.getByTestId('workflow-view')).toBeVisible({ timeout: 1000 });
    await expect(window.getByTestId('workflow-view')).toHaveAttribute('data-active', 'true');
    await expectNoDeferredMainContentLoading(window);

    await window.getByTestId('center-view-whiteboard').click();
    await expect(window.getByTestId('whiteboard-view')).toBeVisible({ timeout: 1000 });
    await expect(window.getByTestId('whiteboard-view')).toHaveAttribute('data-active', 'true');
    await expect(window.getByTestId('whiteboard-view')).toHaveAttribute('data-ready', 'true');
    await expectNoDeferredMainContentLoading(window);

    await window.getByLabel('Code').click();
    await expect(window.getByTestId('panel-center-panel')).toBeVisible({ timeout: 1000 });
  } finally {
    await app.close();
  }
});

test('Ctrl+N creates an untitled file, Ctrl+S saves it, and explorer refreshes to show the saved file', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('untitled-save-workspace');
  createWorkspaceCopy(workspaceCopy);

  const savedFileName = `untitled_e2e_${Date.now()}.sv`;
  const savedRelativePath = `rtl/core/${savedFileName}`;
  const savedAbsolutePath = path.join(workspaceCopy, 'rtl', 'core', savedFileName);
  const savedTreeTestId = `file-tree-node-${savedRelativePath.replace(/[/.]/g, '_').replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const primaryModifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const marker = `untitled_e2e_marker_${Date.now()}`;
  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await window.getByTestId('file-tree-node-README_md').click();
    await waitForMonacoEditor(window);
    await focusMonacoEditor(window);
    await waitForMonacoEditorTextFocus(window);

    await window.keyboard.press(`${primaryModifier}+N`);

    await expect(window.getByTestId('editor-tab-untitled-1')).toBeVisible();
    await expect(window.getByTestId('editor-tab-untitled-1')).toHaveAttribute('data-active', 'true');

    await window.keyboard.type(marker);
    await expect(window.getByTestId('editor-tab-dirty-indicator-untitled-1')).toBeVisible();

    await setNextSaveDialogPath(app, savedAbsolutePath);
    await window.keyboard.press(`${primaryModifier}+S`);

    await expect(window.getByTestId(`editor-tab-${savedRelativePath}`)).toBeVisible();
    await expect(window.getByTestId(`editor-tab-${savedRelativePath}`)).toHaveAttribute('data-active', 'true');
    await expect(window.getByTestId(`editor-tab-dirty-indicator-${savedRelativePath}`)).toHaveCount(0);
    await expect(window.getByTestId('editor-breadcrumb')).toContainText('retroSoC');
    await expect(window.getByTestId('editor-breadcrumb')).toContainText('rtl');
    await expect(window.getByTestId('editor-breadcrumb')).toContainText('core');
    await expect(window.getByTestId('editor-breadcrumb')).toContainText(savedFileName);
    await expect(window.getByTestId(savedTreeTestId)).toBeVisible();
    await expect.poll(() => fs.readFileSync(savedAbsolutePath, 'utf-8')).toContain(marker);

    await app.close();

    const relaunched = await launchApp({ projectRoot: workspaceCopy });

    try {
      await ensureExplorerVisible(relaunched.window);
      await relaunched.window.getByTestId('file-tree-node-rtl').click();
      await relaunched.window.getByTestId('file-tree-node-rtl_core').click();
      await relaunched.window.getByTestId(savedTreeTestId).click();

      await waitForMonacoEditor(relaunched.window);
      await expect(relaunched.window.getByTestId('editor-document-placeholder')).toHaveCount(0);
      await expect(relaunched.window.locator('.monaco-editor .view-lines')).toContainText(marker);

      await relaunched.window.getByTestId(savedTreeTestId).dblclick();
      await expect(relaunched.window.getByTestId(`editor-tab-${savedRelativePath}`)).toBeVisible();
      await expect(relaunched.window.getByTestId('editor-document-placeholder')).toHaveCount(0);
      await expect(relaunched.window.locator('.monaco-editor .view-lines')).toContainText(marker);
    } finally {
      await relaunched.app.close();
    }
  } finally {
    await app.close().catch(() => undefined);
  }
});

test('Explorer New File creates a real workspace file and keeps it after relaunch', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('explorer-create-file-workspace');
  createWorkspaceCopy(workspaceCopy);

  const createdFileName = `explorer_created_${Date.now()}.sv`;
  const createdRelativePath = `rtl/core/${createdFileName}`;
  const createdAbsolutePath = path.join(workspaceCopy, 'rtl', 'core', createdFileName);
  const createdTreeTestId = toWorkspaceTreeTestId(createdRelativePath);
  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await window.getByTestId('file-tree-node-rtl').click();
    await window.getByTestId('file-tree-node-rtl_core').click();
    await window.getByTestId('file-tree-node-rtl_core').click({ button: 'right' });
    await window.getByRole('menuitem', { name: 'New File' }).click();

    const draftInput = window.locator('.explorer-tree-scrollbar input').first();
    await expect(draftInput).toBeVisible();
    await draftInput.fill(createdFileName);
    await draftInput.press('Enter');

    await expect.poll(() => fs.existsSync(createdAbsolutePath), {
      timeout: 15000,
    }).toBe(true);
    await expect(window.getByTestId(createdTreeTestId)).toBeVisible();
    await expect(window.getByTestId(`editor-tab-${createdRelativePath}`)).toBeVisible();

    await app.close();

    const relaunched = await launchApp({ projectRoot: workspaceCopy });

    try {
      await ensureExplorerVisible(relaunched.window);
      await relaunched.window.getByTestId('file-tree-node-rtl').click();
      await relaunched.window.getByTestId('file-tree-node-rtl_core').click();
      await expect(relaunched.window.getByTestId(createdTreeTestId)).toBeVisible();

      await relaunched.window.getByTestId(createdTreeTestId).dblclick();
      await expect(relaunched.window.getByTestId(`editor-tab-${createdRelativePath}`)).toBeVisible();
    } finally {
      await relaunched.app.close();
    }
  } finally {
    await app.close().catch(() => undefined);
  }
});

test('Explorer Rename cascades open child tabs when renaming a folder', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('explorer-rename-folder-workspace');
  createWorkspaceCopy(workspaceCopy);

  const renamedFolderRelativePath = 'rtl/renamed_core';
  const renamedFolderAbsolutePath = path.join(workspaceCopy, 'rtl', 'renamed_core');
  const originalFolderAbsolutePath = path.join(workspaceCopy, 'rtl', 'core');
  const renamedRegFilePath = `${renamedFolderRelativePath}/reg_file.v`;
  const renamedAluFilePath = `${renamedFolderRelativePath}/alu.sv`;
  const { app, window } = await launchApp({ projectRoot: workspaceCopy });
  const explorerTree = window.locator('.explorer-tree-scrollbar');

  try {
    await ensureExplorerVisible(window);
    await openNestedWorkspaceFile(window, [
      'file-tree-node-rtl',
      'file-tree-node-rtl_core',
      'file-tree-node-rtl_core_reg_file_v',
    ], { finalAction: 'dblclick' });
    await window.getByTestId('file-tree-node-rtl_core_alu_sv').dblclick();

    const coreFolderNode = window.getByTestId('file-tree-node-rtl_core');
    await coreFolderNode.click();
    await explorerTree.focus();
    await explorerTree.press('F2');

    const renameInput = window.getByTestId('file-tree-input-rtl_core');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('renamed_core');
    await renameInput.press('Enter');

    await expect(window.getByTestId(`editor-tab-${renamedRegFilePath}`)).toBeVisible();
    await expect(window.getByTestId(`editor-tab-${renamedAluFilePath}`)).toBeVisible();
    await expect(window.getByTestId('editor-breadcrumb')).toContainText('renamed_core');
    await expect.poll(() => fs.existsSync(renamedFolderAbsolutePath), {
      timeout: 15000,
    }).toBe(true);
    await expect.poll(() => fs.existsSync(originalFolderAbsolutePath), {
      timeout: 15000,
    }).toBe(false);
  } finally {
    await app.close();
  }
});

test('Explorer Delete removes a selected workspace file with the Delete key and keeps it deleted after relaunch', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('explorer-delete-file-workspace');
  createWorkspaceCopy(workspaceCopy);

  const deletedRelativePath = 'rtl/core/reg_file.v';
  const deletedAbsolutePath = path.join(workspaceCopy, 'rtl', 'core', 'reg_file.v');
  const deletedTreeTestId = toWorkspaceTreeTestId(deletedRelativePath);
  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await openNestedWorkspaceFile(window, [
      'file-tree-node-rtl',
      'file-tree-node-rtl_core',
      'file-tree-node-rtl_core_reg_file_v',
    ], { finalAction: 'dblclick' });

    const fileNode = window.getByTestId(deletedTreeTestId);
    const explorerTree = window.locator('.explorer-tree-scrollbar');
    await fileNode.click();
    await explorerTree.focus();
    await explorerTree.press('Delete');

    await expect(window.getByTestId('delete-confirmation-dialog')).toBeVisible();
    await expect(window.getByTestId('delete-confirmation-target')).toContainText('reg_file.v');
    await window.getByTestId('delete-confirmation-confirm').click();

    await expect(window.getByTestId('delete-confirmation-dialog')).toHaveCount(0);
    await expect(window.getByTestId(`editor-tab-${deletedRelativePath}`)).toHaveCount(0);
    await expect.poll(() => fs.existsSync(deletedAbsolutePath), {
      timeout: 15000,
    }).toBe(false);
    await expect(window.getByTestId(deletedTreeTestId)).toHaveCount(0);

    await app.close();

    const relaunched = await launchApp({ projectRoot: workspaceCopy });

    try {
      await ensureExplorerVisible(relaunched.window);
      await relaunched.window.getByTestId('file-tree-node-rtl').click();
      await relaunched.window.getByTestId('file-tree-node-rtl_core').click();
      await expect(relaunched.window.getByTestId(deletedTreeTestId)).toHaveCount(0);
    } finally {
      await relaunched.app.close();
    }
  } finally {
    await app.close().catch(() => undefined);
  }
});

test('Explorer Delete shows unsaved changes first, then confirmation, before recursively deleting a folder', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('explorer-delete-folder-workspace');
  createWorkspaceCopy(workspaceCopy);

  const deletedFolderRelativePath = 'rtl/core';
  const deletedFolderAbsolutePath = path.join(workspaceCopy, 'rtl', 'core');
  const deletedRegRelativePath = 'rtl/core/reg_file.v';
  const deletedAluRelativePath = 'rtl/core/alu.sv';
  const { app, window } = await launchApp({ projectRoot: workspaceCopy });
  const explorerTree = window.locator('.explorer-tree-scrollbar');

  try {
    await ensureExplorerVisible(window);
    await openNestedWorkspaceFile(window, [
      'file-tree-node-rtl',
      'file-tree-node-rtl_core',
      'file-tree-node-rtl_core_reg_file_v',
    ], { finalAction: 'dblclick' });
    await waitForMonacoEditor(window);
    await focusMonacoEditor(window);
    await window.keyboard.type('\n// delete me');
    await expect(window.getByTestId(`editor-tab-dirty-indicator-${deletedRegRelativePath}`)).toBeVisible();

    await window.getByTestId('file-tree-node-rtl_core_alu_sv').dblclick();

    const coreFolderNode = window.getByTestId(toWorkspaceTreeTestId(deletedFolderRelativePath));
    await coreFolderNode.click();
    await explorerTree.focus();
    await explorerTree.press('Delete');

    await expect(window.getByTestId('unsaved-changes-dialog')).toBeVisible();
    await expect(window.getByTestId('unsaved-changes-dialog')).toContainText('reg_file.v');
    await expect(window.getByTestId('delete-confirmation-dialog')).toHaveCount(0);

    await window.getByTestId('unsaved-changes-discard').click();

    await expect(window.getByTestId('delete-confirmation-dialog')).toBeVisible();
    await expect(window.getByTestId('delete-confirmation-target')).toContainText('core');
    await window.getByTestId('delete-confirmation-confirm').click();

    await expect(window.getByTestId('delete-confirmation-dialog')).toHaveCount(0);
    await expect(window.getByTestId(`editor-tab-${deletedRegRelativePath}`)).toHaveCount(0);
    await expect(window.getByTestId(`editor-tab-${deletedAluRelativePath}`)).toHaveCount(0);
    await expect.poll(() => fs.existsSync(deletedFolderAbsolutePath), {
      timeout: 15000,
    }).toBe(false);
    await expect(window.getByTestId(toWorkspaceTreeTestId(deletedFolderRelativePath))).toHaveCount(0);
  } finally {
    await app.close().catch(() => undefined);
  }
});

test('Explorer Copy creates a -copy file and keeps it after relaunch', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('explorer-copy-file-workspace');
  createWorkspaceCopy(workspaceCopy);

  const copiedRelativePath = 'rtl/core/reg_file-copy.v';
  const copiedAbsolutePath = path.join(workspaceCopy, 'rtl', 'core', 'reg_file-copy.v');
  const copiedTreeTestId = toWorkspaceTreeTestId(copiedRelativePath);
  const sourceTreeTestId = toWorkspaceTreeTestId('rtl/core/reg_file.v');
  const { app, window } = await launchApp({ projectRoot: workspaceCopy });
  const copiedTreeNode = window.getByTestId(copiedTreeTestId);
  const explorerContextMenu = window.getByTestId('explorer-context-menu');
  const sourceTreeNode = window.getByTestId(sourceTreeTestId);

  try {
    await ensureExplorerVisible(window);
    await expect(window.getByTestId('file-tree-node-rtl')).toBeVisible();
    await window.getByTestId('file-tree-node-rtl').click();
    await expect(window.getByTestId('file-tree-node-rtl_core')).toBeVisible();
    await window.getByTestId('file-tree-node-rtl_core').click();

    await sourceTreeNode.click();
    await expect(sourceTreeNode).toHaveAttribute('data-selected', 'true');

  await sourceTreeNode.click({ button: 'right' });
  await expect(explorerContextMenu).toBeVisible();
  await expect(window.getByRole('menuitem', { name: 'Set as Simulation Top' })).toHaveCount(0);
  await window.getByTestId('explorer-context-menu-item-copy').click();

  await sourceTreeNode.click({ button: 'right' });
  await expect(explorerContextMenu).toBeVisible();
  await expect(window.getByTestId('explorer-context-menu-item-paste')).not.toHaveAttribute('data-disabled', '');
  await window.getByTestId('explorer-context-menu-item-paste').click();

    await expect.poll(() => fs.existsSync(copiedAbsolutePath), {
      timeout: 15000,
    }).toBe(true);
    await expect(copiedTreeNode).toBeVisible({ timeout: 15000 });
    await expect(copiedTreeNode).toHaveAttribute('data-selected', 'true', { timeout: 15000 });

    await app.close();

    const relaunched = await launchApp({ projectRoot: workspaceCopy });

    try {
      const relaunchedCopiedTreeNode = relaunched.window.getByTestId(copiedTreeTestId);

      await ensureExplorerVisible(relaunched.window);
      await expect(relaunched.window.getByTestId('file-tree-node-rtl')).toBeVisible();
      await relaunched.window.getByTestId('file-tree-node-rtl').click();
      await expect(relaunched.window.getByTestId('file-tree-node-rtl_core')).toBeVisible();
      await relaunched.window.getByTestId('file-tree-node-rtl_core').click();
      await expect(relaunchedCopiedTreeNode).toBeVisible({ timeout: 15000 });

      await relaunchedCopiedTreeNode.dblclick();
      await expect(relaunched.window.getByTestId(`editor-tab-${copiedRelativePath}`)).toBeVisible({ timeout: 15000 });
    } finally {
      await relaunched.app.close();
    }
  } finally {
    await app.close().catch(() => undefined);
  }
});

test('Explorer Cut dims the source, Escape cancels it, and pasting to the workspace root moves the file', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('explorer-cut-file-workspace');
  createWorkspaceCopy(workspaceCopy);
  const primaryModifier = process.platform === 'darwin' ? 'Meta' : 'Control';

  const originalRelativePath = 'rtl/core/reg_file.v';
  const movedRelativePath = 'reg_file.v';
  const originalAbsolutePath = path.join(workspaceCopy, 'rtl', 'core', 'reg_file.v');
  const movedAbsolutePath = path.join(workspaceCopy, 'reg_file.v');
  const originalTreeTestId = toWorkspaceTreeTestId(originalRelativePath);
  const movedTreeTestId = toWorkspaceTreeTestId(movedRelativePath);
  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await window.getByTestId('file-tree-node-rtl').click();
    await window.getByTestId('file-tree-node-rtl_core').click();

    const sourceFileNode = window.getByTestId(originalTreeTestId);
    const explorerTree = window.locator('.explorer-tree-scrollbar');

    await sourceFileNode.click();
    await explorerTree.focus();
    await explorerTree.press(`${primaryModifier}+X`);
    await expect(sourceFileNode).toHaveClass(/opacity-50/);

    await explorerTree.press('Escape');
    await expect(sourceFileNode).not.toHaveClass(/opacity-50/);

    await explorerTree.focus();
    await explorerTree.press(`${primaryModifier}+X`);
    await expect(sourceFileNode).toHaveClass(/opacity-50/);

    await window.getByTestId('file-tree-node-README_md').click();
    await explorerTree.focus();
    await explorerTree.press(`${primaryModifier}+V`);

    await expect.poll(() => fs.existsSync(movedAbsolutePath), {
      timeout: 15000,
    }).toBe(true);
    await expect.poll(() => fs.existsSync(originalAbsolutePath), {
      timeout: 15000,
    }).toBe(false);
    await expect(window.getByTestId(originalTreeTestId)).toHaveCount(0);
    await expect(window.getByTestId(movedTreeTestId)).toBeVisible();
    await expect(window.getByTestId(movedTreeTestId)).not.toHaveClass(/opacity-50/);

    await app.close();

    const relaunched = await launchApp({ projectRoot: workspaceCopy });

    try {
      await ensureExplorerVisible(relaunched.window);
      await expect(relaunched.window.getByTestId(movedTreeTestId)).toBeVisible();
      await relaunched.window.getByTestId(movedTreeTestId).dblclick();
      await expect(relaunched.window.getByTestId(`editor-tab-${movedRelativePath}`)).toBeVisible();
      await expect(relaunched.window.getByTestId(originalTreeTestId)).toHaveCount(0);
    } finally {
      await relaunched.app.close();
    }
  } finally {
    await app.close().catch(() => undefined);
  }
});

test('Explorer context menu opens upward near the bottom of the window so all actions remain reachable', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('explorer-context-menu-bottom-workspace');
  createWorkspaceCopy(workspaceCopy);

  const generatedFileCount = 36;
  const targetFileName = `zz_context_menu_${String(generatedFileCount - 1).padStart(2, '0')}.sv`;
  const targetRelativePath = `rtl/core/${targetFileName}`;
  const targetTreeTestId = toWorkspaceTreeTestId(targetRelativePath);

  for (let index = 0; index < generatedFileCount; index += 1) {
    const generatedFileName = `zz_context_menu_${String(index).padStart(2, '0')}.sv`;
    const generatedFilePath = path.join(workspaceCopy, 'rtl', 'core', generatedFileName);
    fs.writeFileSync(
      generatedFilePath,
      `module ${generatedFileName.replace(/\.sv$/, '')};\nendmodule\n`,
      'utf-8',
    );
  }

  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await openNestedWorkspaceFile(window, [
      'file-tree-node-rtl',
      'file-tree-node-rtl_core',
    ]);

    await positionExplorerNodeNearBottom(window, targetTreeTestId);

    const targetNode = window.getByTestId(targetTreeTestId);
    await expect(targetNode).toBeVisible();

    await targetNode.click({ button: 'right' });

    const menu = window.getByTestId('explorer-context-menu');
    const lastAction = window.getByRole('menuitem', { name: 'Copy Relative Path' });

    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('data-side', 'top');
    await expect(lastAction).toBeVisible();

    const [menuBox, lastActionBox, targetBox, viewportHeight] = await Promise.all([
      menu.boundingBox(),
      lastAction.boundingBox(),
      targetNode.boundingBox(),
      window.evaluate(() => (globalThis as unknown as { innerHeight: number }).innerHeight),
    ]);

    if (!menuBox || !lastActionBox || !targetBox) {
      throw new Error('Expected explorer context menu geometry to be measurable');
    }

    const targetBottom = targetBox.y + targetBox.height;
    const menuBottom = menuBox.y + menuBox.height;
    const lastActionBottom = lastActionBox.y + lastActionBox.height;

    expect(targetBottom).toBeGreaterThan(viewportHeight - 120);
    expect(menuBottom).toBeLessThanOrEqual(targetBottom + 2);
    expect(lastActionBottom).toBeLessThanOrEqual(viewportHeight - 1);
  } finally {
    await app.close().catch(() => undefined);
  }
});

test('Explorer rename and delete keep the tree scroll position near the bottom after refreshes', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('explorer-scroll-preservation-workspace');
  createWorkspaceCopy(workspaceCopy);

  const generatedFileCount = 40;
  const renameSourceFileName = `zz_scroll_${String(generatedFileCount - 1).padStart(2, '0')}.sv`;
  const renameTargetFileName = `zz_scroll_${String(generatedFileCount - 1).padStart(2, '0')}_renamed.sv`;
  const deleteFileName = `zz_scroll_${String(generatedFileCount - 2).padStart(2, '0')}.sv`;
  const renameSourceRelativePath = `rtl/core/${renameSourceFileName}`;
  const renameTargetRelativePath = `rtl/core/${renameTargetFileName}`;
  const deleteRelativePath = `rtl/core/${deleteFileName}`;
  const renameSourceAbsolutePath = path.join(workspaceCopy, 'rtl', 'core', renameSourceFileName);
  const renameTargetAbsolutePath = path.join(workspaceCopy, 'rtl', 'core', renameTargetFileName);
  const deleteAbsolutePath = path.join(workspaceCopy, 'rtl', 'core', deleteFileName);
  const renameSourceTreeTestId = toWorkspaceTreeTestId(renameSourceRelativePath);
  const renameTargetTreeTestId = toWorkspaceTreeTestId(renameTargetRelativePath);
  const deleteTreeTestId = toWorkspaceTreeTestId(deleteRelativePath);
  const renameInputTestId = renameSourceTreeTestId.replace('file-tree-node-', 'file-tree-input-');

  for (let index = 0; index < generatedFileCount; index += 1) {
    const generatedFileName = `zz_scroll_${String(index).padStart(2, '0')}.sv`;
    const generatedFilePath = path.join(workspaceCopy, 'rtl', 'core', generatedFileName);
    fs.writeFileSync(
      generatedFilePath,
      `module ${generatedFileName.replace(/\.sv$/, '')};\nendmodule\n`,
      'utf-8',
    );
  }

  const { app, window } = await launchApp({ projectRoot: workspaceCopy });
  const explorerTree = window.locator('.explorer-tree-scrollbar');

  try {
    await ensureExplorerVisible(window);
    await openNestedWorkspaceFile(window, [
      'file-tree-node-rtl',
      'file-tree-node-rtl_core',
    ]);

    await positionExplorerNodeNearBottom(window, renameSourceTreeTestId);

    const renameSourceNode = window.getByTestId(renameSourceTreeTestId);
    await expect(renameSourceNode).toBeVisible();

    const renameSourceBox = await renameSourceNode.boundingBox();
    const viewportHeight = await window.evaluate(() => (globalThis as unknown as { innerHeight: number }).innerHeight);
    if (!renameSourceBox) {
      throw new Error('Expected rename source explorer node geometry to be measurable');
    }

    expect(renameSourceBox.y + renameSourceBox.height).toBeGreaterThan(viewportHeight - 120);

    const beforeRenameScrollTop = await readExplorerTreeScrollTop(window);
    const beforeRenameAnchorTop = await readExplorerNodeTop(window, deleteTreeTestId);

    await openExplorerRenameInput(window, explorerTree, renameSourceNode, renameInputTestId);
    await setExplorerRenameInputValue(window, renameInputTestId, renameTargetFileName);
    const renameScrollTimelinePromise = recordExplorerTreeScrollTopTimeline(window);
    const renameAnchorTimelinePromise = recordExplorerNodeTopTimeline(window, deleteTreeTestId);
    await window.keyboard.press('Enter');

    await expect.poll(() => fs.existsSync(renameTargetAbsolutePath), {
      timeout: 15000,
    }).toBe(true);
    await expect.poll(() => fs.existsSync(renameSourceAbsolutePath), {
      timeout: 15000,
    }).toBe(false);
    await expect(window.getByTestId(renameTargetTreeTestId)).toBeVisible();

    const afterRenameScrollTop = await readExplorerTreeScrollTop(window);
  const afterRenameAnchorTop = await readExplorerNodeTop(window, deleteTreeTestId);
    const renameScrollTimeline = await renameScrollTimelinePromise;
  const renameAnchorTimeline = await renameAnchorTimelinePromise;
    expect(afterRenameScrollTop).toBeGreaterThan(120);
    expect(Math.abs(afterRenameScrollTop - beforeRenameScrollTop)).toBeLessThanOrEqual(40);
    expect(Math.max(...renameScrollTimeline) - Math.min(...renameScrollTimeline)).toBeLessThanOrEqual(2);
  expect(Math.abs(afterRenameAnchorTop - beforeRenameAnchorTop)).toBeLessThanOrEqual(2);
  expect(Math.max(...renameAnchorTimeline) - Math.min(...renameAnchorTimeline)).toBeLessThanOrEqual(2);

    const deleteNode = window.getByTestId(deleteTreeTestId);
    await expect(deleteNode).toBeVisible();
    await deleteNode.click();
    await expect(deleteNode).toHaveAttribute('data-selected', 'true');

    const beforeDeleteScrollTop = await readExplorerTreeScrollTop(window);
  const beforeDeleteAnchorTop = await readExplorerNodeTop(window, renameTargetTreeTestId);

    await explorerTree.focus();
    await expect(explorerTree).toBeFocused();
    const deleteScrollTimelinePromise = recordExplorerTreeScrollTopTimeline(window);
  const deleteAnchorTimelinePromise = recordExplorerNodeTopTimeline(window, renameTargetTreeTestId);
    await explorerTree.press('Delete');

    await expect(window.getByTestId('delete-confirmation-dialog')).toBeVisible();
    await expect(window.getByTestId('delete-confirmation-target')).toContainText(deleteFileName);
    await window.getByTestId('delete-confirmation-confirm').click();

    await expect(window.getByTestId('delete-confirmation-dialog')).toHaveCount(0);
    await expect.poll(() => fs.existsSync(deleteAbsolutePath), {
      timeout: 15000,
    }).toBe(false);
    await expect(window.getByTestId(deleteTreeTestId)).toHaveCount(0);
    await expect(window.getByTestId(renameTargetTreeTestId)).toBeVisible();

    const afterDeleteScrollTop = await readExplorerTreeScrollTop(window);
    const afterDeleteAnchorTop = await readExplorerNodeTop(window, renameTargetTreeTestId);
    const deleteScrollTimeline = await deleteScrollTimelinePromise;
    const deleteAnchorTimeline = await deleteAnchorTimelinePromise;
    expect(afterDeleteScrollTop).toBeGreaterThan(120);
    expect(Math.abs(afterDeleteScrollTop - beforeDeleteScrollTop)).toBeLessThanOrEqual(24);
    expect(Math.max(...deleteScrollTimeline) - Math.min(...deleteScrollTimeline)).toBeLessThanOrEqual(24);
    expect(countTimelineDirectionChanges(deleteScrollTimeline)).toBe(0);
    expect(Math.abs(afterDeleteAnchorTop - beforeDeleteAnchorTop)).toBeLessThanOrEqual(2);
    expect(Math.max(...deleteAnchorTimeline) - Math.min(...deleteAnchorTimeline)).toBeLessThanOrEqual(2);
  } finally {
    await app.close().catch(() => undefined);
  }
});

test('Ctrl+W prompts for dirty untitled files and supports Cancel and Don\'t save', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('untitled-close-workspace');
  createWorkspaceCopy(workspaceCopy);

  const primaryModifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await window.getByTestId('file-tree-node-README_md').click();
    await waitForMonacoEditor(window);
    await focusMonacoEditor(window);
    await waitForMonacoEditorTextFocus(window);

    await window.keyboard.press(`${primaryModifier}+N`);
    await expect(window.getByTestId('editor-tab-untitled-1')).toBeVisible();

    await window.keyboard.type('module close_me; endmodule');
    await expect(window.getByTestId('editor-tab-dirty-indicator-untitled-1')).toBeVisible();

    await window.keyboard.press(`${primaryModifier}+W`);

    await expect(window.getByTestId('unsaved-changes-dialog')).toBeVisible();
    await expect(window.getByTestId('unsaved-changes-single-file')).toContainText('untitled-1');

    await window.getByTestId('unsaved-changes-cancel').click();
    await expect(window.getByTestId('unsaved-changes-dialog')).toHaveCount(0);
    await expect(window.getByTestId('editor-tab-untitled-1')).toBeVisible();

    await window.keyboard.press(`${primaryModifier}+W`);
    await expect(window.getByTestId('unsaved-changes-dialog')).toBeVisible();
    await window.getByTestId('unsaved-changes-discard').click();

    await expect(window.getByTestId('editor-tab-untitled-1')).toHaveCount(0);
    await expect(window.getByTestId('unsaved-changes-dialog')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('explorer shows the real git branch and git file decorations for tracked and ignored paths', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('git-status-workspace');
  createWorkspaceCopy(workspaceCopy);
  initializeGitWorkspaceCopy(workspaceCopy, 'e2e-git-ui');

  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);

    await expect(window.getByTestId('status-bar-branch-label')).toHaveText('e2e-git-ui');
    await expect(window.getByTestId('file-tree-label-ignored-dir')).toHaveClass(/text-ide-text-muted-stronger/);
    await expect(window.getByTestId('file-tree-label-ignored_log')).toHaveClass(/text-ide-text-muted-stronger/);

    await window.getByTestId('file-tree-node-rtl').click();
    await window.getByTestId('file-tree-node-rtl_core').click();

    await expect(window.getByTestId('file-tree-label-rtl_core_reg_file_v')).toHaveClass(/text-ide-warning/);
    await expect(window.getByTestId('file-tree-git-indicator-modified-rtl_core_reg_file_v')).toBeVisible();

    await window.getByTestId('file-tree-node-rtl_core_reg_file_v').dblclick();

    await expect(window.getByTestId('editor-tab-title-rtl/core/reg_file.v')).toHaveClass(/text-ide-warning/);
  } finally {
    await app.close();
  }
});

test('Explorer opens a Monaco git diff tab for a modified file from the context menu', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('git-diff-workspace');
  createWorkspaceCopy(workspaceCopy);
  initializeGitWorkspaceCopy(workspaceCopy, 'e2e-git-diff');

  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await window.getByTestId('file-tree-node-rtl').click();
    await window.getByTestId('file-tree-node-rtl_core').click();

    await window.getByTestId('file-tree-node-rtl_core_alu_sv').click({ button: 'right' });
    await expect(window.getByTestId('explorer-context-menu')).toBeVisible();
    await expect(window.getByTestId('explorer-context-menu-item-open-git-diff')).toHaveCount(0);
    await window.keyboard.press('Escape');

    await window.getByTestId('file-tree-node-rtl_core_reg_file_v').click({ button: 'right' });
    await expect(window.getByTestId('explorer-context-menu-item-open-git-diff')).toBeVisible();
    await window.getByTestId('explorer-context-menu-item-open-git-diff').click();

    await expect(window.getByTestId('editor-tab-title-git-diff:rtl/core/reg_file.v')).toHaveText('reg_file.v Changes');
    await expect(window.getByTestId('monaco-git-diff-pane')).toHaveAttribute('data-file-path', 'rtl/core/reg_file.v');
    await expect(window.locator('.monaco-diff-editor')).toBeVisible();
    await expect(window.getByText('// git modified fixture')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('Monaco editor shows inline git diff for opened modified files and hides it when disabled', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('inline-git-diff-workspace');
  createWorkspaceCopy(workspaceCopy);
  initializeGitWorkspaceCopy(workspaceCopy, 'e2e-inline-git-diff');

  const regFilePath = path.join(workspaceCopy, 'rtl', 'core', 'reg_file.v');
  const regFileContent = fs.readFileSync(regFilePath, 'utf-8');
  fs.writeFileSync(
    regFilePath,
    regFileContent.replace(
      "    assign rs2_data = (rs2 == 5'd0) ? 32'd0 : regs[rs2];",
      "    assign rs2_data = (rs2 == 5'd0) ? 32'h0000_0000 : regs[rs2];",
    ),
    'utf-8',
  );
  const cpuTopFilePath = path.join(workspaceCopy, 'rtl', 'core', 'cpu_top.sv');
  const cpuTopFileContent = fs.readFileSync(cpuTopFilePath, 'utf-8');
  fs.writeFileSync(
    cpuTopFilePath,
    cpuTopFileContent.replace('  logic data_ready;\r\n', '').replace('  logic data_ready;\n', ''),
    'utf-8',
  );
  const createdFileRelativePath = 'rtl/core/created_auto.v';
  fs.writeFileSync(
    path.join(workspaceCopy, 'rtl', 'core', 'created_auto.v'),
    'module created_auto;\n  logic added_signal;\nendmodule',
    'utf-8',
  );

  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await window.getByTestId('file-tree-node-rtl').click();
    await window.getByTestId('file-tree-node-rtl_core').click();
    await window.getByTestId('file-tree-node-rtl_core_reg_file_v').dblclick();
    await waitForMonacoEditor(window);
    await focusMonacoEditor(window);
    await window.keyboard.press('Control+f');
    await window.keyboard.type("32'h0000_0000");
    await window.keyboard.press('Enter');
    await window.keyboard.press('Escape');
    await expect(window.locator('.monaco-editor .view-lines')).toContainText("32'h0000_0000", { timeout: MONACO_READY_TIMEOUT_MS });

    await expect(window.getByTestId('editor-tab-title-rtl/core/reg_file.v')).toHaveClass(/text-ide-warning/);
    const inlineDiffDecoration = window.locator('.pristine-inline-git-diff-line-modified').first();
    const inlineDiffMarginDecoration = window.locator('.pristine-inline-git-diff-margin-modified').first();
    const inlineDiffLineNumber = window.locator('.line-numbers.pristine-inline-git-diff-line-number-modified').first();
    await expect(inlineDiffDecoration).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
    await expect(inlineDiffMarginDecoration).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
    await expect(inlineDiffLineNumber).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
    await expect(inlineDiffDecoration).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(inlineDiffMarginDecoration).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(inlineDiffMarginDecoration).toHaveCSS('background-image', /repeating-linear-gradient/);
    await expect(inlineDiffMarginDecoration).toHaveCSS('background-repeat', 'repeat-y');
    await expect(inlineDiffMarginDecoration).toHaveCSS('background-size', '2px 3px');
    await expect(inlineDiffLineNumber).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    const inlineDiffMarginBox = await inlineDiffMarginDecoration.boundingBox();
    const inlineDiffLineNumberBox = await inlineDiffLineNumber.boundingBox();
    expect(inlineDiffMarginBox?.x).toBeLessThan(inlineDiffLineNumberBox?.x ?? Number.POSITIVE_INFINITY);
    const inlineDiffBackgroundMetrics = await inlineDiffMarginDecoration.evaluate((node) => {
      type BoxLike = { right: number; x: number };
      type ProbeLike = {
        remove: () => void;
        style: { color: string };
      };
      type DocumentLike = {
        body: { appendChild: (node: ProbeLike) => void };
        createElement: (tagName: string) => ProbeLike;
        querySelector: (selectors: string) => ElementLike | null;
      };
      type StyleLike = { backgroundColor: string; color: string };
      type ElementLike = {
        getBoundingClientRect: () => BoxLike;
        ownerDocument: DocumentLike;
      };
      const browserGlobal = globalThis as typeof globalThis & {
        getComputedStyle: (element: ElementLike | ProbeLike) => StyleLike;
      };
      const margin = node as unknown as ElementLike;
      const ownerDocument = margin.ownerDocument;
      const lineNumber = ownerDocument.querySelector('.line-numbers.pristine-inline-git-diff-line-number-modified');
      const line = ownerDocument.querySelector('.pristine-inline-git-diff-line-modified');
      const readBackground = (element: ElementLike | null) => (
        element ? browserGlobal.getComputedStyle(element).backgroundColor : ''
      );
      const readColor = (element: ElementLike | null) => (
        element ? browserGlobal.getComputedStyle(element).color : ''
      );
      const readResolvedColor = (value: string) => {
        const probe = ownerDocument.createElement('span');
        probe.style.color = value;
        ownerDocument.body.appendChild(probe);
        const color = browserGlobal.getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      const marginBox = margin.getBoundingClientRect();
      const lineNumberBox = lineNumber?.getBoundingClientRect();

      return {
        lineBackground: readBackground(line),
        lineNumberBackground: readBackground(lineNumber),
        lineNumberColor: readColor(lineNumber),
        lineNumberLeft: lineNumberBox?.x ?? 0,
        marginBackground: readBackground(margin),
        marginColor: readColor(margin),
        marginRight: marginBox.right,
        warningColor: readResolvedColor('var(--ide-warning)'),
      };
    });
    expect(inlineDiffBackgroundMetrics.marginBackground).toBe(inlineDiffBackgroundMetrics.lineBackground);
    expect(inlineDiffBackgroundMetrics.lineNumberBackground).toBe('rgba(0, 0, 0, 0)');
    expect(inlineDiffBackgroundMetrics.lineNumberColor).toBe(inlineDiffBackgroundMetrics.marginColor);
    expect(inlineDiffBackgroundMetrics.marginColor).toBe(inlineDiffBackgroundMetrics.warningColor);
    expect(inlineDiffBackgroundMetrics.marginRight + 1).toBeGreaterThanOrEqual(inlineDiffBackgroundMetrics.lineNumberLeft);
    await expect(window.getByTestId('editor-breadcrumb-git-indicator-modified')).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
    await expect(window.getByTestId('editor-breadcrumb-git-diff-removed')).toHaveText(/^-\d+$/);
    await expect(window.getByTestId('editor-breadcrumb-git-diff-added')).toHaveText(/^\+\d+$/);
    const breadcrumbDiffMetrics = await window.getByTestId('editor-breadcrumb-git-diff-summary').evaluate((node) => {
      type StyleLike = { color: string; fontFamily: string };
      type ProbeLike = {
        remove: () => void;
        style: { color: string };
      };
      type DocumentLike = {
        body: { appendChild: (node: ProbeLike) => void };
        createElement: (tagName: string) => ProbeLike;
        querySelector: (selectors: string) => ElementLike | null;
      };
      type ElementLike = {
        ownerDocument: DocumentLike;
        querySelector: (selectors: string) => ElementLike | null;
      };
      const browserGlobal = globalThis as typeof globalThis & {
        getComputedStyle: (element: ElementLike | ProbeLike) => StyleLike;
      };
      const summary = node as unknown as ElementLike;
      const ownerDocument = summary.ownerDocument;
      const readResolvedColor = (value: string) => {
        const probe = ownerDocument.createElement('span');
        probe.style.color = value;
        ownerDocument.body.appendChild(probe);
        const color = browserGlobal.getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      const added = summary.querySelector('[data-testid="editor-breadcrumb-git-diff-added"]');
      const removed = summary.querySelector('[data-testid="editor-breadcrumb-git-diff-removed"]');
      const viewLine = ownerDocument.querySelector('.monaco-editor .view-line');

      return {
        addedColor: added ? browserGlobal.getComputedStyle(added).color : '',
        editorFontFamily: viewLine ? browserGlobal.getComputedStyle(viewLine).fontFamily : '',
        removedColor: removed ? browserGlobal.getComputedStyle(removed).color : '',
        successColor: readResolvedColor('var(--ide-success)'),
        summaryFontFamily: browserGlobal.getComputedStyle(summary).fontFamily,
        errorColor: readResolvedColor('var(--ide-error)'),
      };
    });
    expect(breadcrumbDiffMetrics.removedColor).toBe(breadcrumbDiffMetrics.errorColor);
    expect(breadcrumbDiffMetrics.addedColor).toBe(breadcrumbDiffMetrics.successColor);
    expect(breadcrumbDiffMetrics.summaryFontFamily).not.toBe('');
    expect(breadcrumbDiffMetrics.editorFontFamily).not.toBe('');
    expect(normalizeComparableMonospaceFontFamily(breadcrumbDiffMetrics.summaryFontFamily)).toBe(
      normalizeComparableMonospaceFontFamily(breadcrumbDiffMetrics.editorFontFamily),
    );
    await expect(window.getByTestId('monaco-inline-git-diff-detail')).toHaveCount(0);

    await inlineDiffMarginDecoration.click();
    const inlineDiffDetail = window.getByTestId('monaco-inline-git-diff-detail').first();
    const inlineDiffDetailTitle = window.getByTestId('monaco-inline-git-diff-detail-title').first();
    const inlineDiffDetailBody = window.getByTestId('monaco-inline-git-diff-detail-body').first();
    const inlineDiffDetailClose = window.getByTestId('monaco-inline-git-diff-detail-close').first();
    await expect(inlineDiffDetailTitle).toHaveText('Git Local Changes - modified change');
    await expect(inlineDiffDetailBody).toContainText("assign rs2_data = (rs2 == 5'd0) ? 32'd0 : regs[rs2];");
    await expect(inlineDiffDetailBody).toContainText("assign rs2_data = (rs2 == 5'd0) ? 32'h0000_0000 : regs[rs2];");
    await expect(inlineDiffDetailClose).toBeVisible();

    const inlineDiffDetailPlacementMetrics = await inlineDiffDetail.evaluate((node) => {
      type BoxLike = { height: number; y: number };
      type ElementLike = {
        getBoundingClientRect: () => BoxLike;
      };
      const browserGlobal = globalThis as typeof globalThis & {
        document: { querySelectorAll: (selectors: string) => ArrayLike<ElementLike> };
      };
      const detail = node as unknown as ElementLike;
      const changedLines = Array.from(browserGlobal.document.querySelectorAll('.pristine-inline-git-diff-line-modified'));
      const lastChangedLine = changedLines[changedLines.length - 1];
      const detailBox = detail.getBoundingClientRect();
      const changedLineBox = lastChangedLine?.getBoundingClientRect();

      return {
        changedLineBottom: changedLineBox ? changedLineBox.y + changedLineBox.height : 0,
        detailTop: detailBox.y,
      };
    });
    expect(inlineDiffDetailPlacementMetrics.detailTop + 1).toBeGreaterThanOrEqual(inlineDiffDetailPlacementMetrics.changedLineBottom);

    const inlineDiffDetailMetrics = await inlineDiffDetail.evaluate((node) => {
      type BoxLike = { height: number };
      type StyleLike = { backgroundColor: string; color: string; fontFamily: string; fontSize: string; lineHeight: string };
      type ElementLike = {
        clientHeight: number;
        getBoundingClientRect: () => BoxLike;
        querySelector: (selectors: string) => ElementLike | null;
        scrollHeight: number;
      };
      const browserGlobal = globalThis as typeof globalThis & {
        document: { querySelector: (selectors: string) => ElementLike | null };
        getComputedStyle: (element: ElementLike) => StyleLike;
      };
      const detail = node as unknown as ElementLike;
      const header = detail.querySelector('.pristine-inline-git-diff-detail-header');
      const title = detail.querySelector('[data-testid="monaco-inline-git-diff-detail-title"]');
      const body = detail.querySelector('[data-testid="monaco-inline-git-diff-detail-body"]');
      const content = detail.querySelector('.pristine-inline-git-diff-detail-content');
      const editor = browserGlobal.document.querySelector('.monaco-editor');
      const viewLine = browserGlobal.document.querySelector('.monaco-editor .view-line');
      const readColor = (element: ElementLike | null, property: 'backgroundColor' | 'color') => (
        element ? browserGlobal.getComputedStyle(element)[property] : 'rgb(0, 0, 0)'
      );
      const toRgbTuple = (red = '0', green = '0', blue = '0'): [number, number, number] => [
        Number(red),
        Number(green),
        Number(blue),
      ];
      const parseRgbColor = (value: string) => {
        const rgbMatch = value.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/);
        if (rgbMatch) {
          return toRgbTuple(rgbMatch[1], rgbMatch[2], rgbMatch[3]);
        }

        const srgbMatch = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
        if (!srgbMatch) {
          return toRgbTuple();
        }

        return toRgbTuple(
          String(Number(srgbMatch[1] ?? 0) * 255),
          String(Number(srgbMatch[2] ?? 0) * 255),
          String(Number(srgbMatch[3] ?? 0) * 255),
        );
      };
      const relativeLuminance = (color: [number, number, number]) => {
        const channels = color.map((component) => {
          const channel = component / 255;
          return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        const r = channels[0] ?? 0;
        const g = channels[1] ?? 0;
        const b = channels[2] ?? 0;

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const contrastRatio = (foreground: string, background: string) => {
        const foregroundLuminance = relativeLuminance(parseRgbColor(foreground));
        const backgroundLuminance = relativeLuminance(parseRgbColor(background));
        const lighter = Math.max(foregroundLuminance, backgroundLuminance);
        const darker = Math.min(foregroundLuminance, backgroundLuminance);

        return (lighter + 0.05) / (darker + 0.05);
      };
      const detailBox = detail.getBoundingClientRect();
      const headerBox = header?.getBoundingClientRect();
      const titleColor = readColor(title, 'color');
      const editorBackground = readColor(editor, 'backgroundColor');
      const contentStyle = content ? browserGlobal.getComputedStyle(content) : null;
      const titleStyle = title ? browserGlobal.getComputedStyle(title) : null;
      const viewLineStyle = viewLine ? browserGlobal.getComputedStyle(viewLine) : null;

      return {
        bodyClientHeight: body?.clientHeight ?? 0,
        bodyScrollHeight: body?.scrollHeight ?? 0,
        contentFontFamily: contentStyle?.fontFamily ?? '',
        contentFontSize: contentStyle?.fontSize ?? '',
        contentLineHeight: contentStyle?.lineHeight ?? '',
        detailHeight: detailBox.height,
        editorFontFamily: viewLineStyle?.fontFamily ?? '',
        editorFontSize: viewLineStyle?.fontSize ?? '',
        editorLineHeight: viewLineStyle?.lineHeight ?? '',
        headerHeight: headerBox?.height ?? 0,
        titleFontSize: titleStyle?.fontSize ?? '',
        titleToEditorContrast: contrastRatio(titleColor, editorBackground),
      };
    });
    expect(inlineDiffDetailMetrics.bodyClientHeight + 1).toBeGreaterThanOrEqual(inlineDiffDetailMetrics.bodyScrollHeight);
    expect(inlineDiffDetailMetrics.detailHeight + 1).toBeGreaterThanOrEqual(
      inlineDiffDetailMetrics.headerHeight + inlineDiffDetailMetrics.bodyScrollHeight,
    );
    expect(inlineDiffDetailMetrics.contentFontFamily).not.toBe('');
    expect(inlineDiffDetailMetrics.editorFontFamily).not.toBe('');
    expect(normalizeComparableMonospaceFontFamily(inlineDiffDetailMetrics.contentFontFamily)).toBe(
      normalizeComparableMonospaceFontFamily(inlineDiffDetailMetrics.editorFontFamily),
    );
    expect(inlineDiffDetailMetrics.contentFontSize).toBe(inlineDiffDetailMetrics.editorFontSize);
    expect(inlineDiffDetailMetrics.contentLineHeight).toBe(inlineDiffDetailMetrics.editorLineHeight);
    expect(Number.parseFloat(inlineDiffDetailMetrics.titleFontSize)).toBeLessThan(Number.parseFloat(inlineDiffDetailMetrics.contentFontSize));
    expect(inlineDiffDetailMetrics.titleToEditorContrast).toBeGreaterThan(3);

    await closeInlineGitDiffDetail(window);
    await inlineDiffMarginDecoration.click();
    await expect(window.getByTestId('monaco-inline-git-diff-detail')).toBeVisible();

    await window.getByTestId(toWorkspaceTreeTestId(createdFileRelativePath)).dblclick();
    await waitForMonacoEditor(window);
    await expect(window.locator('.monaco-editor .view-lines')).toContainText('module created_auto', { timeout: MONACO_READY_TIMEOUT_MS });
    await expect(window.locator('.pristine-inline-git-diff-margin-added').first()).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
    await expect(window.getByTestId('editor-breadcrumb-git-indicator-created')).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
    await expect(window.getByTestId('editor-breadcrumb-git-diff-added')).toHaveText('+3');
    await expect(window.getByTestId('editor-breadcrumb-git-diff-removed')).toHaveCount(0);

    await window.getByTestId('file-tree-node-rtl_core_reg_file_v').dblclick();
    await waitForMonacoEditor(window);
    await expect(window.locator('.monaco-editor .view-lines')).toContainText("32'h0000_0000", { timeout: MONACO_READY_TIMEOUT_MS });

    await window.getByTestId(toWorkspaceTreeTestId(createdFileRelativePath)).dblclick();
    await waitForMonacoEditor(window);
    await expect(window.locator('.monaco-editor .view-lines')).toContainText('module created_auto', { timeout: MONACO_READY_TIMEOUT_MS });
    await expect(window.locator('.pristine-inline-git-diff-margin-added').first()).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
    await expect(window.getByTestId('editor-breadcrumb-git-indicator-created')).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
    await expect(window.getByTestId('editor-breadcrumb-git-diff-added')).toHaveText('+3');
    await expect(window.getByTestId('editor-breadcrumb-git-diff-removed')).toHaveCount(0);

    await window.getByTestId('file-tree-node-rtl_core_cpu_top_sv').dblclick();
    await waitForMonacoEditor(window);
    await expect(window.getByTestId('editor-tab-rtl/core/cpu_top.sv')).toHaveAttribute('data-active', 'true');
    await expect(window.locator('.monaco-editor .view-lines')).toContainText("data_ready = 1'b1", { timeout: MONACO_READY_TIMEOUT_MS });
    const removedInlineDiffMarginDecoration = window.locator('.pristine-inline-git-diff-margin-removed').first();
    const removedInlineDiffLineNumber = window.locator('.line-numbers.pristine-inline-git-diff-line-number-removed').first();
    await expect(removedInlineDiffMarginDecoration).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
    await expect(removedInlineDiffMarginDecoration).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(removedInlineDiffMarginDecoration).toHaveCSS('background-repeat', 'repeat-y');
    await expect(removedInlineDiffMarginDecoration).toHaveCSS('background-image', /repeating-linear-gradient/);
    await expect(removedInlineDiffMarginDecoration).toHaveCSS('background-size', '2px 3px');
    await expect(removedInlineDiffLineNumber).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
    await expect(removedInlineDiffLineNumber).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await removedInlineDiffMarginDecoration.click();
    await expect(window.getByTestId('monaco-inline-git-diff-detail-body')).toContainText('logic data_ready;');

    await closeInlineGitDiffDetail(window);

    await window.getByTestId('menu-settings-button').click();
    await expect(window.getByTestId('settings-dialog')).toBeVisible();
    await openSettingsPage(window, 'editor');
    const inlineGitDiffBackgroundsSwitch = window.getByTestId('settings-editor-inline-git-diff-backgrounds-switch');
    await inlineGitDiffBackgroundsSwitch.scrollIntoViewIfNeeded();
    await setSwitchChecked(inlineGitDiffBackgroundsSwitch, false);
    await window.getByTestId('settings-close-button').click();

    const backgroundlessInlineDiffMarginDecoration = window.locator('.pristine-inline-git-diff-margin').first();
    await expect(backgroundlessInlineDiffMarginDecoration).toBeVisible({ timeout: MONACO_READY_TIMEOUT_MS });
    await expect(window.locator('.line-numbers.pristine-inline-git-diff-line-number')).toHaveCount(0);
    await expect(window.locator('.pristine-inline-git-diff-line-added, .pristine-inline-git-diff-line-modified, .pristine-inline-git-diff-line-removed-anchor')).toHaveCount(0);
    await expect(window.getByTestId('editor-breadcrumb-git-diff-summary')).toBeVisible();
    await backgroundlessInlineDiffMarginDecoration.click();
    await expect(window.getByTestId('monaco-inline-git-diff-detail-body')).toContainText('logic data_ready;');

    await window.getByTestId('menu-settings-button').click();
    await expect(window.getByTestId('settings-dialog')).toBeVisible();
    await openSettingsPage(window, 'editor');
    const inlineGitDiffSwitch = window.getByTestId('settings-editor-inline-git-diff-switch');
    await inlineGitDiffSwitch.scrollIntoViewIfNeeded();
    await setSwitchChecked(inlineGitDiffSwitch, false);
    await window.getByTestId('settings-close-button').click();

    await expect(window.getByTestId('monaco-inline-git-diff-detail')).toHaveCount(0);
    await expect(window.locator('.pristine-inline-git-diff-line-added, .pristine-inline-git-diff-line-modified, .pristine-inline-git-diff-line-removed-anchor')).toHaveCount(0);
    await expect(window.locator('.pristine-inline-git-diff-margin')).toHaveCount(0);
    await expect(window.getByTestId('editor-breadcrumb-git-diff-summary')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('explorer status bar updates the git branch label after refocusing the app window', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('git-branch-refresh-workspace');
  createWorkspaceCopy(workspaceCopy);
  initializeGitWorkspaceCopy(workspaceCopy, 'e2e-git-ui');
  execFileSync('git', ['branch', 'e2e-git-ui-next'], { cwd: workspaceCopy, stdio: 'pipe', windowsHide: true });

  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await expect(window.getByTestId('status-bar-branch-label')).toHaveText('e2e-git-ui');

    execFileSync('git', ['switch', 'e2e-git-ui-next'], { cwd: workspaceCopy, stdio: 'pipe', windowsHide: true });
    await notifyAppWindowFocused(app);

    await expect(window.getByTestId('status-bar-branch-label')).toHaveText('e2e-git-ui-next');
  } finally {
    await app.close();
  }
});

test('explorer git decorations refresh after external workspace and branch changes', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('git-auto-refresh-workspace');
  createWorkspaceCopy(workspaceCopy);
  initializeGitWorkspaceCopy(workspaceCopy, 'e2e-git-ui');
  execFileSync('git', ['branch', 'e2e-git-ui-next'], { cwd: workspaceCopy, stdio: 'pipe', windowsHide: true });

  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await window.getByTestId('file-tree-node-rtl').click();
    await window.getByTestId('file-tree-node-rtl_core').click();

    await expect(window.getByTestId('status-bar-branch-label')).toHaveText('e2e-git-ui');

    fs.appendFileSync(path.join(workspaceCopy, 'rtl', 'core', 'cpu_top.sv'), '\n// e2e auto refresh marker\n', 'utf-8');
    fs.writeFileSync(path.join(workspaceCopy, 'rtl', 'core', 'created_auto.v'), 'module created_auto; endmodule\n', 'utf-8');
    fs.rmSync(path.join(workspaceCopy, 'rtl', 'core', 'alu.sv'));
    execFileSync('git', ['switch', 'e2e-git-ui-next'], { cwd: workspaceCopy, stdio: 'pipe', windowsHide: true });

    await expect(window.getByTestId('status-bar-branch-label')).toHaveText('e2e-git-ui-next');
    await expect(window.getByTestId('file-tree-label-rtl_core_cpu_top_sv')).toHaveClass(/text-ide-warning/);
    await expect(window.getByTestId('file-tree-label-rtl_core_created_auto_v')).toHaveClass(/text-ide-success/);
    await expect(window.getByTestId('file-tree-git-indicator-created-rtl_core_created_auto_v')).toBeVisible();
    await expect(window.getByTestId('file-tree-git-indicator-created-rtl_core')).toBeVisible();
    await expect(window.getByTestId('file-tree-git-indicator-modified-rtl_core')).toBeVisible();
    await expect(window.getByTestId('file-tree-git-indicator-deleted-rtl_core')).toBeVisible();

    await expect.poll(async () => {
      return window.getByTestId('file-tree-git-indicators-rtl_core').locator('[data-testid^="file-tree-git-indicator-"]').evaluateAll(
        (elements) => elements.map((element) => (element as { getAttribute: (name: string) => string | null }).getAttribute('data-testid')),
      );
    }).toEqual([
      'file-tree-git-indicator-created-rtl_core',
      'file-tree-git-indicator-modified-rtl_core',
      'file-tree-git-indicator-deleted-rtl_core',
    ]);
  } finally {
    await app.close();
  }
});

test('ctrl+z does not restore the loading placeholder after undo returns a file to its initial state', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('undo-workspace');
  createWorkspaceCopy(workspaceCopy);

  const marker = `//e2e-undo-marker-${Date.now()}`;
  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await openNestedWorkspaceFile(window, [
      'file-tree-node-rtl',
      'file-tree-node-rtl_core',
      'file-tree-node-rtl_core_reg_file_v',
    ]);

    const dirtyIndicator = window.getByTestId('editor-tab-dirty-indicator-rtl/core/reg_file.v');
    const editorLines = window.locator('.monaco-editor .view-lines').first();

    await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
    await waitForMonacoEditor(window);
    await focusMonacoEditor(window);
    await waitForMonacoEditorTextFocus(window);
    await window.keyboard.press('Control+End');
    await window.keyboard.type(` ${marker}`);

    await expect(dirtyIndicator).toBeVisible();
    await expect(editorLines).toContainText(marker, { timeout: MONACO_READY_TIMEOUT_MS });

    for (let index = 0; index < 10; index += 1) {
      await window.keyboard.press('Control+Z');

      if (await dirtyIndicator.count() === 0) {
        break;
      }
    }

    await expect(dirtyIndicator).toHaveCount(0);
    await expect(editorLines).not.toContainText(marker, { timeout: MONACO_READY_TIMEOUT_MS });

    await window.keyboard.press('Control+Z');

    await expect(dirtyIndicator).toHaveCount(0);
    await expect(editorLines).not.toContainText(marker);
    await expect(editorLines).not.toContainText('Loading file contents...');
    await expect(editorLines).toContainText('module reg_file', { timeout: MONACO_READY_TIMEOUT_MS });
  } finally {
    await app.close();
  }
});

test('menu bar switches to the BlockSuite whiteboard editor', async () => {
  const { app, window } = await launchApp();
  const whiteboardErrors: string[] = [];

  window.on('pageerror', (error) => {
    whiteboardErrors.push(error.message);
  });
  window.on('console', (message) => {
    if (message.type() === 'error') {
      whiteboardErrors.push(message.text());
    }
  });

  await switchToWhiteboard(window);

  const whiteboardView = window.getByTestId('whiteboard-view');
  const whiteboardHost = window.getByTestId('whiteboard-host');
  const whiteboardEditor = window.getByTestId('whiteboard-edgeless-editor');
  const switchWorkbenchTheme = async (optionTestId: string) => {
    await window.getByTestId('menu-settings-button').click();
    await expect(window.getByTestId('settings-dialog')).toBeVisible();
    await openSettingsPage(window, 'appearance');
    await selectComboboxOption(window, 'settings-theme-combobox', optionTestId);
    await window.getByTestId('settings-close-button').click();
    await expect(window.getByTestId('settings-dialog')).toHaveCount(0);
  };

  await expect(whiteboardView).toBeVisible();
  await expect(whiteboardView).toContainText('Whiteboard');
  await expect(whiteboardEditor).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await switchWorkbenchTheme('settings-theme-option-vscode-2026-light');
  await expect(whiteboardView).toHaveAttribute('data-theme', 'light');
  await expect(whiteboardEditor).toHaveAttribute('data-theme', 'light');
  await expect(whiteboardEditor).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(whiteboardView.locator('edgeless-editor')).toHaveCount(1);
  await expect(whiteboardView.locator('.affine-edgeless-viewport')).toHaveCount(1);
  await expect(whiteboardView.locator('editor-host')).toHaveCount(1, { timeout: UI_READY_TIMEOUT_MS });
  await expect(whiteboardView.locator('affine-edgeless-root')).toHaveCount(1, { timeout: UI_READY_TIMEOUT_MS });
  const toolbarWrapper = whiteboardView.locator('edgeless-toolbar-widget .edgeless-toolbar-wrapper');
  const readToolbarOverlayPanelColor = () =>
    toolbarWrapper.evaluate((element) => {
      const browserGlobal = globalThis as unknown as {
        getComputedStyle: (element: unknown) => { getPropertyValue: (name: string) => string };
      };
      return browserGlobal.getComputedStyle(element).getPropertyValue('--affine-background-overlay-panel-color').trim();
    });
  await expect(toolbarWrapper).toHaveAttribute('data-app-theme', 'light', { timeout: UI_READY_TIMEOUT_MS });
  await expect
    .poll(readToolbarOverlayPanelColor, { timeout: UI_READY_TIMEOUT_MS })
    .toBe('rgb(251, 251, 252)');
  const lightToolbarOverlayPanelColor = await readToolbarOverlayPanelColor();
  await expect
    .poll(
      () => whiteboardHost.evaluate((host) => Boolean((host as HTMLElement & { shadowRoot?: unknown }).shadowRoot)),
      { timeout: UI_READY_TIMEOUT_MS },
    )
    .toBe(false);
  await expect
    .poll(
      () =>
        whiteboardEditor.evaluate((editor) => {
          const root = (editor as HTMLElement & { getRootNode: () => { nodeType: number } }).getRootNode();
          return root.nodeType === 9;
        }),
      { timeout: UI_READY_TIMEOUT_MS },
    )
    .toBe(true);

  await switchWorkbenchTheme('settings-theme-option-vscode-2026-dark');

  await expect(whiteboardView).toHaveAttribute('data-theme', 'dark', { timeout: UI_READY_TIMEOUT_MS });
  await expect(whiteboardEditor).toHaveAttribute('data-theme', 'dark', { timeout: UI_READY_TIMEOUT_MS });
  await expect(whiteboardEditor).toHaveCSS('color-scheme', 'dark');
  await expect(whiteboardView.locator('edgeless-editor')).toHaveCount(1);
  await expect(whiteboardView.locator('.affine-edgeless-viewport')).toHaveAttribute('data-theme', 'dark', {
    timeout: UI_READY_TIMEOUT_MS,
  });
  await expect(toolbarWrapper).toHaveAttribute('data-app-theme', 'dark', { timeout: UI_READY_TIMEOUT_MS });
  await expect
    .poll(readToolbarOverlayPanelColor, { timeout: UI_READY_TIMEOUT_MS })
    .not.toBe(lightToolbarOverlayPanelColor);

  await switchWorkbenchTheme('settings-theme-option-vscode-2026-light');

  await expect(whiteboardView).toHaveAttribute('data-theme', 'light', { timeout: UI_READY_TIMEOUT_MS });
  await expect(whiteboardEditor).toHaveAttribute('data-theme', 'light', { timeout: UI_READY_TIMEOUT_MS });
  await expect(whiteboardView.locator('.affine-edgeless-viewport')).toHaveAttribute('data-theme', 'light', {
    timeout: UI_READY_TIMEOUT_MS,
  });
  await expect(toolbarWrapper).toHaveAttribute('data-app-theme', 'light', { timeout: UI_READY_TIMEOUT_MS });

  const noteEditor = whiteboardView.locator('.inline-editor[contenteditable="true"]').first();
  await noteEditor.click({ force: true });
  await window.keyboard.type('/');
  await expect(window.locator('affine-slash-menu')).toHaveCount(1, { timeout: UI_READY_TIMEOUT_MS });
  await window.keyboard.press('Escape');

  await noteEditor.click({ force: true });
  const noteContainer = whiteboardView.locator('[data-testid="edgeless-note-container"]').first();
  await expect(noteContainer).toHaveAttribute('data-editing', 'true', { timeout: UI_READY_TIMEOUT_MS });
  const noteBackground = whiteboardView.locator('edgeless-note-background').first();
  await expect(noteBackground).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  const noteBackgroundVisualState = await noteBackground.evaluate((element) => {
    const browserGlobal = globalThis as unknown as {
      getComputedStyle: (element: unknown) => {
        boxShadow: string;
        height: string;
        left: string;
        position: string;
        top: string;
        transitionProperty: string;
        width: string;
      };
    };
    const style = browserGlobal.getComputedStyle(element);
    const rect = (element as { getBoundingClientRect: () => { height: number; width: number } }).getBoundingClientRect();

    return {
      boxShadow: style.boxShadow,
      height: rect.height,
      left: style.left,
      position: style.position,
      top: style.top,
      transitionProperty: style.transitionProperty,
      width: rect.width,
      cssWidth: style.width,
      cssHeight: style.height,
    };
  });
  expect(noteBackgroundVisualState.position).toBe('absolute');
  expect(noteBackgroundVisualState.width).toBeGreaterThan(0);
  expect(noteBackgroundVisualState.height).toBeGreaterThan(0);
  expect(noteBackgroundVisualState.cssWidth).not.toBe('auto');
  expect(noteBackgroundVisualState.cssHeight).not.toBe('auto');
  expect(noteBackgroundVisualState.transitionProperty).toContain('left');
  expect(noteBackgroundVisualState.boxShadow).not.toBe('none');
  const getBackgroundColor = (element: unknown) => {
    const browserGlobal = globalThis as unknown as {
      getComputedStyle: (element: unknown) => { backgroundColor: string };
    };

    return browserGlobal.getComputedStyle(element).backgroundColor;
  };
  const initialNoteBackground = await noteBackground.evaluate(getBackgroundColor);

  await window.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      document: {
        querySelector: (selector: string) => unknown | null;
      };
    };
    const edgelessRoot = browserGlobal.document.querySelector('affine-edgeless-root') as {
      gfx?: {
        selection?: {
          set: (selection: { elements: string[] }) => void;
        };
      };
    } | null;
    const note = browserGlobal.document.querySelector('affine-edgeless-note') as {
      model?: {
        id?: string;
      };
      getAttribute?: (name: string) => string | null;
    } | null;
    const noteId = note?.model?.id ?? note?.getAttribute?.('data-block-id');

    if (!edgelessRoot?.gfx?.selection || !noteId) {
      throw new Error('Expected selectable BlockSuite note on the whiteboard');
    }

    edgelessRoot.gfx.selection.set({ elements: [noteId] });
  });

  const noteStyleButton = window.locator('affine-toolbar-widget editor-icon-button[aria-label="Note Style"]');
  await expect(noteStyleButton).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await noteStyleButton.click();
  const yellowSwatch = window.locator('edgeless-color-panel .color-unit[aria-label="Yellow"]');
  await expect(yellowSwatch).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await yellowSwatch.click();
  await expect
    .poll(() => noteBackground.evaluate(getBackgroundColor), {
      timeout: UI_READY_TIMEOUT_MS,
    })
    .not.toBe(initialNoteBackground);
  await expect
    .poll(() => noteBackground.evaluate(getBackgroundColor), {
      timeout: UI_READY_TIMEOUT_MS,
    })
    .toBe('rgb(253, 230, 138)');
  expect(whiteboardErrors.filter((message) => message.includes('Illegal constructor'))).toEqual([]);

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
  await expect(window.getByTestId('editor-tab-README.md')).toHaveAttribute('data-active', 'true');

  await window.keyboard.press('Control+P');
  const quickOpenInput = window.getByTestId('quick-open-input');
  await expect(quickOpenInput).toBeFocused();

  await quickOpenInput.press('ArrowDown');
  await quickOpenInput.press('Enter');

  await expect(window.getByTestId('quick-open-overlay')).toHaveCount(0);
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveAttribute('data-active', 'true');
  await expect(window.getByTestId('editor-tab-README.md')).toHaveAttribute('data-active', 'false');

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
  await waitForMonacoEditor(window);
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

  await quickOpenInput.fill('reg');
  await expect(window.getByTestId('quick-open-result-rtl_core_reg_file_v')).toBeVisible();

  await quickOpenInput.press('Escape');
  await expect(window.getByTestId('quick-open-overlay')).toHaveCount(0);

  await window.keyboard.press('Control+P');
  const reopenedInput = window.getByTestId('quick-open-input');
  await expect(reopenedInput).toHaveValue('');
  await expect(window.getByTestId('quick-open-result-README_md')).toBeVisible();

  await app.close();
});

test('dark theme keeps quick open and explorer rename input text legible', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await window.getByTestId('menu-settings-button').click();
  await expect(window.getByTestId('settings-dialog')).toBeVisible();
  await openSettingsPage(window, 'appearance');

  await selectComboboxOption(
    window,
    'settings-theme-combobox',
    'settings-theme-option-vscode-2026-dark',
  );

  await expect.poll(async () => readConfigValue(window, 'workbench.colorTheme')).toBe('vscode-2026-dark');
  await window.getByTestId('settings-close-button').click();
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0);

  const expectedQuickInputColor = await readNormalizedCssColorVariable(window, '--quick-input-foreground');
  const expectedInputColor = await readNormalizedCssColorVariable(window, '--input-foreground');

  expect(expectedQuickInputColor).not.toBe('rgb(0, 0, 0)');
  expect(expectedInputColor).not.toBe('rgb(0, 0, 0)');

  await window.keyboard.press('Control+P');
  const quickOpenInput = window.getByTestId('quick-open-input');
  await expect(quickOpenInput).toBeFocused();
  await expect.poll(() => readComputedTextColor(quickOpenInput)).toBe(expectedQuickInputColor);
  await quickOpenInput.press('Escape');
  await expect(window.getByTestId('quick-open-overlay')).toHaveCount(0);

  const explorerTree = window.locator('.explorer-tree-scrollbar');
  await expect(explorerTree).toBeVisible();
  const renameInput = await openExplorerRenameInput(
    window,
    explorerTree,
    window.getByTestId('file-tree-node-README_md'),
    'file-tree-input-README_md',
  );
  await expect.poll(() => readComputedTextColor(renameInput)).toBe(expectedInputColor);
  await renameInput.press('Escape');
  await expect(renameInput).toHaveCount(0);

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
  await expect(getCursorStatus(window)).toHaveText('1:1');
  await expect(window.getByTestId('status-bar').getByTestId('status-bar-cursor-icon')).toBeVisible();
  await expect(window.getByTestId('status-bar').getByTestId('status-bar-file-format-icon')).toBeVisible();
  await expect(window.getByTestId('status-bar').getByText('LF:UTF-8', { exact: true })).toBeVisible();
  await expect(window.getByTestId('status-bar').getByTestId('status-bar-indentation-icon')).toBeVisible();
  await expect(window.getByTestId('status-bar').getByText('4 spaces', { exact: true })).toBeVisible();
  await expect(window.getByTestId('status-bar').getByTestId('status-bar-language-icon')).toHaveAttribute('data-icon-key', 'verilog');

  const cursorIconBox = await window.getByTestId('status-bar-cursor-icon').boundingBox();
  const fileFormatIconBox = await window.getByTestId('status-bar-file-format-icon').boundingBox();
  const indentationIconBox = await window.getByTestId('status-bar-indentation-icon').boundingBox();
  const languageIconBox = await window.getByTestId('status-bar-language-icon').boundingBox();
  const notificationsBox = await window.getByTestId('status-bar-notifications').boundingBox();

  expect(cursorIconBox).not.toBeNull();
  expect(fileFormatIconBox).not.toBeNull();
  expect(indentationIconBox).not.toBeNull();
  expect(languageIconBox).not.toBeNull();
  expect(notificationsBox).not.toBeNull();

  await moveMonacoCursor(window, { down: 12, right: 10 });
  await expect(getCursorStatus(window)).toHaveText('14:10');

  const widenedCursorNotificationsBox = await window.getByTestId('status-bar-notifications').boundingBox();
  const widenedCursorFileFormatIconBox = await window.getByTestId('status-bar-file-format-icon').boundingBox();
  const widenedCursorIndentationIconBox = await window.getByTestId('status-bar-indentation-icon').boundingBox();
  const widenedCursorLanguageIconBox = await window.getByTestId('status-bar-language-icon').boundingBox();
  const widenedCursorIconBox = await window.getByTestId('status-bar-cursor-icon').boundingBox();

  expect(widenedCursorIconBox).not.toBeNull();
  expect(widenedCursorFileFormatIconBox).not.toBeNull();
  expect(widenedCursorIndentationIconBox).not.toBeNull();
  expect(widenedCursorLanguageIconBox).not.toBeNull();
  expect(widenedCursorNotificationsBox).not.toBeNull();
  expect(Math.round(widenedCursorIconBox!.x)).toBeLessThan(Math.round(cursorIconBox!.x));
  expect(Math.round(widenedCursorFileFormatIconBox!.x)).toBe(Math.round(fileFormatIconBox!.x));
  expect(Math.round(widenedCursorIndentationIconBox!.x)).toBe(Math.round(indentationIconBox!.x));
  expect(Math.round(widenedCursorLanguageIconBox!.x)).toBe(Math.round(languageIconBox!.x));
  expect(Math.round(widenedCursorNotificationsBox!.x)).toBe(Math.round(notificationsBox!.x));

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
  await expect(getCursorStatus(window)).toHaveText('1:1');
  await expect(window.getByTestId('status-bar').getByTestId('status-bar-cursor-icon')).toBeVisible();
  await expect(window.getByTestId('status-bar').getByTestId('status-bar-file-format-icon')).toBeVisible();
  await expect(window.getByTestId('status-bar').getByText('LF:UTF-8', { exact: true })).toBeVisible();
  await expect(window.getByTestId('status-bar').getByTestId('status-bar-indentation-icon')).toBeVisible();
  await expect(window.getByTestId('status-bar').getByText('4 spaces', { exact: true })).toBeVisible();
  await expect(window.getByTestId('status-bar').getByTestId('status-bar-language-icon')).toHaveAttribute('data-icon-key', 'verilog');

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
  await expect(getCursorStatus(window)).toHaveText('1:1');

  await moveMonacoCursor(window, { down: 3, right: 4 });
  await expect(getCursorStatus(window)).toHaveText('4:5');

  await window.getByTestId('file-tree-node-README_md').dblclick();
  await expect(window.getByTestId('editor-tab-README.md')).toBeVisible();
  await expect(getCursorStatus(window)).toHaveText('1:1');

  await window.getByTestId('editor-tab-rtl/core/reg_file.v').click();
  await expect(getCursorStatus(window)).toHaveText('4:5');

  await window.getByTestId('editor-tab-close-rtl/core/reg_file.v').click();
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveCount(0);

  await window.getByTestId('file-tree-node-rtl_core_reg_file_v').dblclick();
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(getCursorStatus(window)).toHaveText('4:5');

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
  await expect(getCursorStatus(window)).toHaveText('3:7');

  await window.keyboard.press('Control+P');
  const quickOpenInput = window.getByTestId('quick-open-input');
  await expect(quickOpenInput).toBeFocused();

  await quickOpenInput.fill('read');
  await quickOpenInput.press('Escape');

  await expect(window.getByTestId('quick-open-overlay')).toHaveCount(0);
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveAttribute('data-active', 'true');
  await expect(getCursorStatus(window)).toHaveText('3:7');

  await window.keyboard.press('ArrowDown');
  await expect(getCursorStatus(window)).toHaveText('4:7');

  await app.close();
});

test('explorer root toggles first-level children and hides the legacy collapse-all control', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  const collapseAllButton = window.getByRole('button', { name: 'Collapse All' });
  const rootNode = window.getByTestId('file-tree-node-root');
  const rootIcon = window.getByTestId('file-tree-icon-root');
  const rtlNode = window.getByTestId('file-tree-node-rtl');

  await expect(collapseAllButton).toHaveCount(0);
  await expect(rootNode).toBeVisible();
  await expect(rootIcon).toHaveClass(/(?:^|\s)h-2\.5(?:\s|$)/);
  await expect(rootIcon).toHaveClass(/(?:^|\s)w-2\.5(?:\s|$)/);
  await expect(window.getByTestId('left-panel-header')).not.toContainText('retroSoC');
  await expect(rootNode).toContainText('retroSoC');
  await expect(rtlNode).toBeVisible();

  await test.step('root row collapses and expands first-level children', async () => {
    await rootNode.click();
    await expect(rtlNode).toHaveCount(0);

    await rootNode.click();
    await expect(rtlNode).toBeVisible();
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
  await expectCollapsedPanel(window.getByTestId('panel-simulation-left-panel'));
  await expectCollapsedPanel(window.getByTestId('panel-simulation-bottom-panel'));
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
  await expectCollapsedPanel(window.getByTestId('panel-simulation-left-panel'));
  await expectCollapsedPanel(window.getByTestId('panel-simulation-bottom-panel'));
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

test('assistant panel mounts only while the right panel AI tab is active', async () => {
  const { app, window } = await launchApp();

  try {
    await ensureExplorerVisible(window);

    const rightPanelToggle = window.getByTestId('toggle-right-panel');
    const rightPanel = window.getByTestId('panel-right-panel');
    const assistantPanel = window.getByTestId('assistant-panel-root');

    await expect(rightPanel).toHaveCount(0);
    await expect(assistantPanel).toHaveCount(0);

    await rightPanelToggle.click();

    await expect(rightPanel).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
    await expect(assistantPanel).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

    await window.getByTestId('right-panel-tab-outline').click();
    await expect(assistantPanel).toHaveCount(0);

    await window.getByTestId('right-panel-tab-ai').click();
    await expect(assistantPanel).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  } finally {
    await app.close();
  }
});

test('assistant model selector uses shared command search styling and local provider logos', async () => {
  const { app, window } = await launchApp();

  try {
    const searchInput = await openAssistantModelSelector(window);
    const expectedTextColor = await readNormalizedCssColorVariable(window, '--ide-text');
    const visualState = await readSearchInputVisualState(searchInput);
    const sectionHeaders = window.locator('[data-slot="model-selector-section-header"]');

    await expect(searchInput).toHaveClass(/(?:^|\s)pristine-command-search-input(?:\s|$)/);
    expect(visualState.color).toBe(expectedTextColor);
    expect(visualState.caretColor).toBe(expectedTextColor);
    expect(visualState.webkitTextFillColor).toBe(expectedTextColor);

    await expect(sectionHeaders).toHaveCount(2);
    await expect(sectionHeaders.nth(0)).toHaveText('Official');
    await expect(sectionHeaders.nth(1)).toHaveText('Gateway');
    await expect(window.getByTestId('model-selector-provider-openrouter')).toBeVisible({
      timeout: UI_READY_TIMEOUT_MS,
    });

    const moreTrigger = window.getByTestId('model-selector-provider-more');
    await expect(moreTrigger).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
    await moreTrigger.hover();
    await expect(window.getByTestId('model-selector-provider-mastra')).toBeVisible({
      timeout: UI_READY_TIMEOUT_MS,
    });

    await searchInput.fill('openrouter');
    await expect(window.locator('[data-slot="model-selector-provider"]').filter({ hasText: 'OpenRouter' })).toBeVisible({
      timeout: UI_READY_TIMEOUT_MS,
    });

    await expectModelProviderLogoLoaded(window, 'OpenRouter', 'model-provider-logos/openrouter.svg');
  } finally {
    await app.close();
  }
});

test('assistant chat list expansion widens the whole right sidebar and supports internal drag resize', async () => {
  test.slow();

  const chatListResizeDeltaPx = 60;
  const expectedExpandedChatListWidthPx = ASSISTANT_THREAD_LIST_DEFAULT_WIDTH_PX;
  const expectedExpandedRightPanelExtraWidthPx = expectedExpandedChatListWidthPx + ASSISTANT_THREAD_LIST_RESIZE_HANDLE_WIDTH_PX;
  const expectedResizedChatListWidthPx = expectedExpandedChatListWidthPx + chatListResizeDeltaPx;

  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);

  const rightPanelToggle = window.getByTestId('toggle-right-panel');
  const rightPanel = window.getByTestId('panel-right-panel');
  const splitToggle = window.getByTestId('right-panel-split-toggle');
  const assistantMainPanel = window.getByTestId('assistant-main-panel');
  const chatListToggle = window.getByTestId('assistant-thread-list-toggle');
  const chatListPanel = window.getByTestId('assistant-thread-list-panel');
  const chatListResizeHandle = window.getByTestId('assistant-thread-list-resize-handle');
  const secondaryResizablePanel = window.getByTestId('panel-right-panel-secondary');

  await expect(rightPanelToggle).toBeEnabled();
  await rightPanelToggle.click();

  await expect(rightPanel).toBeVisible();
  await expect(splitToggle).toBeVisible();
  await splitToggle.click();
  await expect(splitToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(secondaryResizablePanel).toHaveAttribute('aria-hidden', 'false');
  await expect(chatListPanel).toHaveAttribute('aria-hidden', 'true');
  await expectCompactPanelTabButton(window.getByTestId('right-panel-tab-ai'));
  await expectCompactPanelTabButton(window.getByTestId('right-panel-tab-outline'));
  await expect(assistantMainPanel).not.toHaveClass(/(?:^|\s)bg-background(?:\s|$)/);
  await expect(window.getByTestId('assistant-panel-header')).toBeVisible();
  await expect(window.getByTestId('assistant-panel-header').getByText('Pristine Agent')).toHaveCount(0);
  await expect(window.getByTestId('right-panel-secondary-tabs')).toBeVisible();
  await expectCompactPanelTabButton(window.getByTestId('right-panel-secondary-tab-module-info'));
  await expectCompactPanelTabButton(window.getByTestId('right-panel-secondary-tab-resource-usage'));
  await expectCompactPanelTabButton(window.getByTestId('right-panel-secondary-tab-x-propagation'));
  await expect(window.getByTestId('right-panel-secondary-placeholder')).toHaveAttribute('data-right-panel-secondary-tab', 'module-info');
  await expect(window.getByTestId('right-panel-secondary-placeholder')).toContainText('Module Information');
  await expect(window.getByTestId('right-panel-secondary-placeholder')).toContainText('Register map placeholder');

  const initialRightPanelWidth = await waitForElementPixelWidthBetween(rightPanel, 295, 305);
  const initialAssistantWidth = await waitForElementPixelWidthBetween(assistantMainPanel, 295, 305);
  const expectedResizedRightPanelWidthPx = initialRightPanelWidth
    + expectedResizedChatListWidthPx
    + ASSISTANT_THREAD_LIST_RESIZE_HANDLE_WIDTH_PX;

  await chatListToggle.click();

  await expect(chatListPanel).toBeVisible();
  await expect(chatListPanel).not.toHaveClass(/(?:^|\s)bg-muted\/20(?:\s|$)/);

  await waitForElementPixelWidthBetween(
    chatListPanel,
    expectedExpandedChatListWidthPx - 5,
    expectedExpandedChatListWidthPx + 5,
  );
  await expect.poll(() => readElementPixelWidth(rightPanel)).toBeGreaterThanOrEqual(
    initialRightPanelWidth + expectedExpandedRightPanelExtraWidthPx - 5,
  );
  await expect.poll(() => readElementPixelWidth(rightPanel)).toBeLessThanOrEqual(
    initialRightPanelWidth + expectedExpandedRightPanelExtraWidthPx + 5,
  );
  const expandedRightPanelWidth = await readElementPixelWidth(rightPanel);
  await waitForElementPixelWidthBetween(
    assistantMainPanel,
    initialAssistantWidth - 2,
    initialAssistantWidth + 2,
  );

  expect(expandedRightPanelWidth).toBeGreaterThanOrEqual(initialRightPanelWidth + expectedExpandedRightPanelExtraWidthPx - 5);
  expect(expandedRightPanelWidth).toBeLessThanOrEqual(initialRightPanelWidth + expectedExpandedRightPanelExtraWidthPx + 5);

  await chatListResizeHandle.evaluate((element) => {
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
      clientX: 620,
      pointerId: 11,
    }));
    handle.dispatchEvent(new PointerEventCtor('pointermove', {
      bubbles: true,
      clientX: 560,
      pointerId: 11,
    }));
    handle.dispatchEvent(new PointerEventCtor('pointerup', {
      bubbles: true,
      clientX: 560,
      pointerId: 11,
    }));
  });

  await expect.poll(() => readElementPixelWidth(chatListPanel)).toBeGreaterThanOrEqual(expectedResizedChatListWidthPx - 5);
  await expect.poll(() => readElementPixelWidth(chatListPanel)).toBeLessThanOrEqual(expectedResizedChatListWidthPx + 5);
  await expect.poll(() => readElementPixelWidth(rightPanel)).toBeGreaterThanOrEqual(expectedResizedRightPanelWidthPx - 5);
  await expect.poll(() => readElementPixelWidth(rightPanel)).toBeLessThanOrEqual(expectedResizedRightPanelWidthPx + 5);
  await expect.poll(() => readElementPixelWidth(assistantMainPanel)).toBeGreaterThanOrEqual(initialAssistantWidth - 2);
  await expect.poll(() => readElementPixelWidth(assistantMainPanel)).toBeLessThanOrEqual(initialAssistantWidth + 2);
  await expect(secondaryResizablePanel).toHaveAttribute('aria-hidden', 'false');

  const resizedRightPanelWidth = await readElementPixelWidth(rightPanel);
  const resizedAssistantWidth = await readElementPixelWidth(assistantMainPanel);

  expect(resizedRightPanelWidth).toBeGreaterThan(expandedRightPanelWidth + 50);
  expect(resizedAssistantWidth).toBeGreaterThanOrEqual(initialAssistantWidth - 2);
  expect(resizedAssistantWidth).toBeLessThanOrEqual(initialAssistantWidth + 2);

  await app.close();
});

test('right panel split shows two stacked panels and keeps the panel layout-aware', async () => {
  test.slow();

  const { app, window } = await launchApp();

  try {
    await ensureExplorerVisible(window);

    const rightPanelToggle = window.getByTestId('toggle-right-panel');
    const rightPanelShell = window.getByTestId('panel-right-panel');
    const splitToggle = window.getByTestId('right-panel-split-toggle');
    const rightPanelRoot = window.getByTestId('right-panel-root');
    const primaryPanel = window.getByTestId('right-panel-primary-panel');
    const secondaryPanel = window.getByTestId('right-panel-secondary-panel');
    const primaryResizablePanel = window.getByTestId('panel-right-panel-primary');
    const secondaryResizablePanel = window.getByTestId('panel-right-panel-secondary');
    const splitHandle = window.getByTestId('right-panel-split-resize-handle');

    await expect(rightPanelToggle).toBeEnabled();
    await rightPanelToggle.click();

    await expect(rightPanelShell).toBeVisible();
    await expect(splitToggle).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
    await expect(splitToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(primaryPanel).not.toHaveClass(/(?:^|\s)rounded-md(?:\s|$)/);
    await expect(primaryResizablePanel).toHaveCount(0);
    await expect(secondaryResizablePanel).toHaveCount(0);
    await expect(secondaryPanel).toHaveCount(0);
    await expect(splitHandle).toHaveCount(0);

    await splitToggle.click();

    await expect(splitToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(primaryResizablePanel).toHaveAttribute('style', /transition-duration: 300ms/);
    await expect(secondaryResizablePanel).toHaveAttribute('style', /transition-duration: 300ms/);
    await expect(primaryResizablePanel).toHaveAttribute('aria-hidden', 'false');
    await expect(secondaryResizablePanel).toHaveAttribute('aria-hidden', 'false');
    await expect(rightPanelRoot).not.toHaveClass(/(?:^|\s)bg-ide-bg(?:\s|$)/);
    await expect(primaryPanel).toHaveClass(/(?:^|\s)rounded-md(?:\s|$)/);
    await expect(primaryPanel).toHaveClass(/(?:^|\s)border(?:\s|$)/);
    await expect(primaryPanel).toHaveClass(/(?:^|\s)bg-ide-bg(?:\s|$)/);
    await expect(secondaryPanel).toBeVisible();
    await expect(secondaryPanel).toHaveClass(/(?:^|\s)rounded-md(?:\s|$)/);
    await expect(secondaryPanel).toHaveClass(/(?:^|\s)border(?:\s|$)/);
    await expect(secondaryPanel).toHaveClass(/(?:^|\s)bg-ide-bg(?:\s|$)/);
    await expect(window.getByTestId('right-panel-secondary-header')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');
    await expect(window.getByTestId('right-panel-secondary-tabs')).toBeVisible();
    await expect(window.getByTestId('right-panel-secondary-placeholder')).toHaveAttribute('data-right-panel-secondary-tab', 'module-info');
    await expect(window.getByTestId('right-panel-secondary-placeholder')).toContainText('Module Information');
    await window.getByTestId('right-panel-secondary-tab-resource-usage').click();
    await expect(window.getByTestId('right-panel-secondary-placeholder')).toHaveAttribute('data-right-panel-secondary-tab', 'resource-usage');
    await expect(window.getByTestId('right-panel-secondary-placeholder')).toContainText('Module Resource Usage');
    await window.getByTestId('right-panel-secondary-tab-x-propagation').click();
    await expect(window.getByTestId('right-panel-secondary-placeholder')).toHaveAttribute('data-right-panel-secondary-tab', 'x-propagation');
    await expect(window.getByTestId('right-panel-secondary-placeholder')).toContainText('X Propagation');
    await expect(splitHandle).toBeVisible();
    await expect(splitHandle).toHaveAttribute('aria-orientation', 'horizontal');
    await expect(splitHandle).toHaveClass(/(?:^|\s)overlay-handle(?:\s|$)/);

    await expect.poll(async () => {
      const [primaryHeight, secondaryHeight] = await Promise.all([
        readElementPixelHeight(primaryResizablePanel),
        readElementPixelHeight(secondaryResizablePanel),
      ]);

      return Math.abs(primaryHeight - secondaryHeight);
    }, { timeout: UI_READY_TIMEOUT_MS }).toBeLessThanOrEqual(10);

    const initialPrimaryHeight = await readElementPixelHeight(primaryResizablePanel);
    const initialSecondaryHeight = await readElementPixelHeight(secondaryResizablePanel);
    const splitHandleBox = await splitHandle.boundingBox();

    if (!splitHandleBox) {
      throw new Error('Expected right panel split handle geometry to be measurable');
    }

    await window.mouse.move(
      splitHandleBox.x + splitHandleBox.width / 2,
      splitHandleBox.y + splitHandleBox.height / 2,
    );
    await window.mouse.down();
    await window.mouse.move(
      splitHandleBox.x + splitHandleBox.width / 2,
      splitHandleBox.y + splitHandleBox.height / 2 + 80,
    );
    await window.mouse.up();

    await expect.poll(() => readElementPixelHeight(primaryResizablePanel), { timeout: UI_READY_TIMEOUT_MS }).toBeGreaterThan(initialPrimaryHeight + 55);
    await expect.poll(() => readElementPixelHeight(secondaryResizablePanel), { timeout: UI_READY_TIMEOUT_MS }).toBeLessThan(initialSecondaryHeight - 55);

    await expectPanelHeaderWithoutDivider(window.getByTestId('right-panel-header'));
    await expectPanelHeaderWithoutDivider(window.getByTestId('right-panel-secondary-header'));
    await expect(rightPanelShell).not.toHaveClass(/(?:^|\s)rounded-md(?:\s|$)/);
    await expect(rightPanelShell).not.toHaveClass(/(?:^|\s)border(?:\s|$)/);
    await expect(rightPanelShell).not.toHaveClass(/(?:^|\s)bg-ide-bg(?:\s|$)/);
    await expect(rightPanelRoot).not.toHaveClass(/(?:^|\s)bg-ide-bg(?:\s|$)/);
    await expect(primaryPanel).toHaveClass(/(?:^|\s)rounded-md(?:\s|$)/);
    await expect(primaryPanel).toHaveClass(/(?:^|\s)border(?:\s|$)/);
    await expect(secondaryPanel).toHaveClass(/(?:^|\s)rounded-md(?:\s|$)/);
    await expect(secondaryPanel).toHaveClass(/(?:^|\s)border(?:\s|$)/);
    await expect(splitHandle).toHaveClass(/(?:^|\s)overlay-handle(?:\s|$)/);
    await expect.poll(() => readVerticalPixelGap(primaryResizablePanel, secondaryResizablePanel), { timeout: UI_READY_TIMEOUT_MS }).toBeGreaterThanOrEqual(9);
    await expect.poll(() => readVerticalPixelGap(primaryResizablePanel, secondaryResizablePanel), { timeout: UI_READY_TIMEOUT_MS }).toBeLessThanOrEqual(11);

    await splitToggle.click();
    await expect(splitToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(secondaryResizablePanel).toHaveAttribute('aria-hidden', 'true');
    await expect(window.getByTestId('right-panel-secondary-panel')).toHaveAttribute('style', /opacity: 0/);
    await expect(splitHandle).toHaveCount(0);
    await expect(secondaryPanel).toHaveCount(0, { timeout: UI_READY_TIMEOUT_MS });
  } finally {
    await app.close().catch(() => undefined);
  }
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
  await expect(statusBar.getByText(/^\d+:\d+$/)).toHaveCount(0);
  await expect(statusBar.getByText('LF:UTF-8', { exact: true })).toHaveCount(0);
  await expect(statusBar.getByText('4 spaces', { exact: true })).toHaveCount(0);
  await expect(statusBar.getByTestId('status-bar-cursor-icon')).toHaveCount(0);
  await expect(statusBar.getByTestId('status-bar-file-format-icon')).toHaveCount(0);
  await expect(statusBar.getByTestId('status-bar-indentation-icon')).toHaveCount(0);
  await expect(statusBar.getByTestId('status-bar-language-icon')).toHaveCount(0);
  await expect(statusBar.getByTestId('status-bar-notifications')).toBeVisible();

  await app.close();
});

test('explorer status bar hover cards switch cleanly between adjacent items', async () => {
  const { app, window } = await launchApp();
  await ensureExplorerVisible(window);
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ]);
  await waitForMonacoEditor(window);

  type FocusableTriggerNode = {
    focus?: () => void;
    getAttribute?: (name: string) => string | null;
    parentElement?: FocusableTriggerNode | null;
  };

  const focusHoverCardTrigger = async (label: Locator) => {
    await label.evaluate((element) => {
      let trigger = element as unknown as FocusableTriggerNode | null;

      while (trigger && trigger.getAttribute?.('data-slot') !== 'hover-card-trigger') {
        trigger = trigger.parentElement ?? null;
      }

      if (!trigger || typeof trigger.focus !== 'function') {
        throw new Error('Expected a hover-card trigger for the status bar item');
      }

      trigger.focus();
    });
  };

  const statusBar = window.getByTestId('status-bar');
  const branchLabel = statusBar.getByTestId('status-bar-branch-label');
  const syncLabel = statusBar.getByText('Sync', { exact: true });
  const branchCardTitle = window.getByText('Git Branch', { exact: true });
  const syncCardTitle = window.getByText('Sync Status', { exact: true });
  const languageIcon = statusBar.getByTestId('status-bar-language-icon');
  const languageCardTitle = window.getByText('Language Mode', { exact: true });
  const languageCardDescription = window.getByText('Verilog', { exact: true });

  await expect(statusBar).toHaveAttribute('data-status-bar-id', 'code-explorer');
  await expect(branchLabel).toBeVisible();
  await expect(syncLabel).toBeVisible();
  await expect(statusBar.getByTestId('status-bar-cursor-icon')).toBeVisible();
  await expect(statusBar.getByTestId('status-bar-file-format-icon')).toBeVisible();
  await expect(statusBar.getByText('LF:UTF-8', { exact: true })).toBeVisible();
  await expect(statusBar.getByTestId('status-bar-indentation-icon')).toBeVisible();
  await expect(statusBar.getByText('4 spaces', { exact: true })).toBeVisible();
  await expect(languageIcon).toHaveAttribute('data-icon-key', 'verilog');

  await focusHoverCardTrigger(branchLabel);
  await expect(branchCardTitle).toBeVisible();

  await focusHoverCardTrigger(syncLabel);

  await expect(branchCardTitle).toHaveCount(0);
  await expect(syncCardTitle).toBeVisible();

  await focusHoverCardTrigger(languageIcon);

  await expect(syncCardTitle).toHaveCount(0);
  await expect(languageCardTitle).toBeVisible();
  await expect(languageCardDescription).toBeVisible();

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
  await expect(leftHandle).toBeAttached();
  await expect(leftHandle).toHaveClass(/(?:^|\s)overlay-handle(?:\s|$)/);

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

test('left panel split shows two stacked panels and keeps the explorer tree scrollable', async () => {
  test.slow();

  const workspaceCopy = test.info().outputPath('left-panel-split-workspace');
  createWorkspaceCopy(workspaceCopy);

  const generatedFileCount = 72;
  const generatedDir = path.join(workspaceCopy, 'rtl', 'core');
  fs.mkdirSync(generatedDir, { recursive: true });

  for (let index = 0; index < generatedFileCount; index += 1) {
    const generatedFileName = `zz_split_scroll_${String(index).padStart(2, '0')}.sv`;
    fs.writeFileSync(
      path.join(generatedDir, generatedFileName),
      `module ${generatedFileName.replace(/\.sv$/, '')};\nendmodule\n`,
      'utf-8',
    );
  }

  const { app, window } = await launchApp({ projectRoot: workspaceCopy });

  try {
    await ensureExplorerVisible(window);
    await window.getByTestId('file-tree-node-rtl').click();
    await window.getByTestId('file-tree-node-rtl_core').click();
    await expect(window.getByTestId(toWorkspaceTreeTestId('rtl/core/zz_split_scroll_71.sv'))).toBeAttached();

    const splitToggle = window.getByTestId('left-panel-split-toggle');
    const leftPanelRoot = window.getByTestId('left-panel-root');
    const leftPanelShell = window.getByTestId('panel-left-panel');
    const primaryPanel = window.getByTestId('left-panel-primary-panel');
    const secondaryPanel = window.getByTestId('left-panel-secondary-panel');
    const primaryResizablePanel = window.getByTestId('panel-left-panel-primary');
    const secondaryResizablePanel = window.getByTestId('panel-left-panel-secondary');
    const splitHandle = window.getByTestId('left-panel-split-resize-handle');

    await expect(splitToggle).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
    await expect(splitToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(primaryPanel).not.toHaveClass(/(?:^|\s)rounded-md(?:\s|$)/);
    await expect(primaryResizablePanel).toHaveCount(0);
    await expect(secondaryResizablePanel).toHaveCount(0);
    await expect(secondaryPanel).toHaveCount(0);
    await expect(splitHandle).toHaveCount(0);
    await expect.poll(async () => (await scrollExplorerTreeToBottom(window)).scrollTop, { timeout: UI_READY_TIMEOUT_MS }).toBeGreaterThan(0);

    await splitToggle.click();

    await expect(splitToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(primaryResizablePanel).toHaveAttribute('style', /transition-duration: 300ms/);
    await expect(secondaryResizablePanel).toHaveAttribute('style', /transition-duration: 300ms/);
    await expect(primaryResizablePanel).toHaveAttribute('aria-hidden', 'false');
    await expect(secondaryResizablePanel).toHaveAttribute('aria-hidden', 'false');
    await expect(leftPanelRoot).not.toHaveClass(/(?:^|\s)bg-ide-bg(?:\s|$)/);
    await expect(primaryPanel).toHaveClass(/(?:^|\s)rounded-md(?:\s|$)/);
    await expect(primaryPanel).toHaveClass(/(?:^|\s)border(?:\s|$)/);
    await expect(primaryPanel).toHaveClass(/(?:^|\s)bg-ide-bg(?:\s|$)/);
    await expect(secondaryPanel).toBeVisible();
    await expect(secondaryPanel).toHaveClass(/(?:^|\s)rounded-md(?:\s|$)/);
    await expect(secondaryPanel).toHaveClass(/(?:^|\s)border(?:\s|$)/);
    await expect(secondaryPanel).toHaveClass(/(?:^|\s)bg-ide-bg(?:\s|$)/);
    await expect(window.getByTestId('left-panel-secondary-header')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');
    await expect.poll(async () => (
      await window.getByTestId('hierarchy-tree').count()
      + await window.getByTestId('left-panel-secondary-placeholder').count()
    ), { timeout: UI_READY_TIMEOUT_MS }).toBeGreaterThan(0);
    await expect(splitHandle).toBeVisible();
    await expect(splitHandle).toHaveAttribute('aria-orientation', 'horizontal');
    await expect(splitHandle).toHaveClass(/(?:^|\s)overlay-handle(?:\s|$)/);

    await expect.poll(async () => {
      const [primaryHeight, secondaryHeight] = await Promise.all([
        readElementPixelHeight(primaryResizablePanel),
        readElementPixelHeight(secondaryResizablePanel),
      ]);

      return Math.abs(primaryHeight - secondaryHeight);
    }, { timeout: UI_READY_TIMEOUT_MS }).toBeLessThanOrEqual(10);
    await expect.poll(async () => (await scrollExplorerTreeToBottom(window)).scrollTop, { timeout: UI_READY_TIMEOUT_MS }).toBeGreaterThan(0);

    const initialPrimaryHeight = await readElementPixelHeight(primaryResizablePanel);
    const initialSecondaryHeight = await readElementPixelHeight(secondaryResizablePanel);
    const splitHandleBox = await splitHandle.boundingBox();

    if (!splitHandleBox) {
      throw new Error('Expected left panel split handle geometry to be measurable');
    }

    await window.mouse.move(
      splitHandleBox.x + splitHandleBox.width / 2,
      splitHandleBox.y + splitHandleBox.height / 2,
    );
    await window.mouse.down();
    await window.mouse.move(
      splitHandleBox.x + splitHandleBox.width / 2,
      splitHandleBox.y + splitHandleBox.height / 2 + 80,
    );
    await window.mouse.up();

    await expect.poll(() => readElementPixelHeight(primaryResizablePanel), { timeout: UI_READY_TIMEOUT_MS }).toBeGreaterThan(initialPrimaryHeight + 55);
    await expect.poll(() => readElementPixelHeight(secondaryResizablePanel), { timeout: UI_READY_TIMEOUT_MS }).toBeLessThan(initialSecondaryHeight - 55);

    await window.getByTestId('menu-settings-button').click();
    await expect(window.getByTestId('settings-dialog')).toBeVisible();
    await selectComboboxOption(
      window,
      'settings-code-viewer-layout-combobox',
      'settings-code-viewer-layout-option-minimal',
    );
    await expect.poll(async () => readConfigValue(window, 'workbench.codeViewerLayoutMode')).toBe('minimal');
    await window.getByTestId('settings-close-button').click();
    await expect(window.getByTestId('settings-dialog')).toHaveCount(0);

    await expectPanelHeaderWithoutDivider(window.getByTestId('left-panel-header'));
    await expectPanelHeaderWithoutDivider(window.getByTestId('left-panel-secondary-header'));
  await expect(leftPanelShell).not.toHaveClass(/(?:^|\s)rounded-md(?:\s|$)/);
  await expect(leftPanelShell).not.toHaveClass(/(?:^|\s)border(?:\s|$)/);
  await expect(leftPanelShell).not.toHaveClass(/(?:^|\s)bg-ide-bg(?:\s|$)/);
  await expect(leftPanelRoot).not.toHaveClass(/(?:^|\s)bg-ide-bg(?:\s|$)/);
  await expect(primaryPanel).toHaveClass(/(?:^|\s)rounded-md(?:\s|$)/);
  await expect(primaryPanel).toHaveClass(/(?:^|\s)border(?:\s|$)/);
  await expect(secondaryPanel).toHaveClass(/(?:^|\s)rounded-md(?:\s|$)/);
  await expect(secondaryPanel).toHaveClass(/(?:^|\s)border(?:\s|$)/);
    await expect(splitHandle).toHaveClass(/(?:^|\s)overlay-handle(?:\s|$)/);
    await expect.poll(() => readVerticalPixelGap(primaryResizablePanel, secondaryResizablePanel), { timeout: UI_READY_TIMEOUT_MS }).toBeGreaterThanOrEqual(9);
    await expect.poll(() => readVerticalPixelGap(primaryResizablePanel, secondaryResizablePanel), { timeout: UI_READY_TIMEOUT_MS }).toBeLessThanOrEqual(11);
    await expect.poll(async () => (await scrollExplorerTreeToBottom(window)).scrollTop, { timeout: UI_READY_TIMEOUT_MS }).toBeGreaterThan(0);

    await splitToggle.click();
    await expect(splitToggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => {
      if (await secondaryResizablePanel.count() === 0) {
        return 'unmounted';
      }

      const ariaHidden = await secondaryResizablePanel.getAttribute('aria-hidden');
      const secondaryPanelStyle = await window.getByTestId('left-panel-secondary-panel').getAttribute('style');

      return ariaHidden === 'true' && /opacity:\s*0/.test(secondaryPanelStyle ?? '')
        ? 'hidden'
        : 'visible';
    }, { timeout: UI_READY_TIMEOUT_MS }).toMatch(/^(hidden|unmounted)$/);
    await expect(splitHandle).toHaveCount(0);
    await expect(secondaryPanel).toHaveCount(0, { timeout: UI_READY_TIMEOUT_MS });
  } finally {
    await app.close().catch(() => undefined);
  }
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
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ]);

  const firstGroup = window.getByTestId('editor-group-group-1');
  await firstGroup.getByTestId('editor-split-right').click();

  const secondGroup = window.getByTestId('editor-group-group-2');
  await expect(secondGroup).toBeVisible();

  await expectVisibleEditorsToContainText(window, 2, 'module reg_file');

  const secondGroupBounds = await secondGroup.boundingBox();
  if (!secondGroupBounds) {
    throw new Error('Expected second editor group bounds');
  }

  await secondGroup.getByTestId('editor-tab-rtl/core/reg_file.v').dragTo(secondGroup, {
    targetPosition: {
      x: Math.max(Math.floor(secondGroupBounds.width / 2), 24),
      y: Math.max(Math.floor(secondGroupBounds.height - 18), 24),
    },
  });

  await expect(editorGroups).toHaveCount(3);
  await expectVisibleEditorsToContainText(window, 3, 'module reg_file');

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
  await expect(firstGroup).not.toHaveClass(/(?:^|\s)ring-primary\/50(?:\s|$)/);

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

  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveAttribute('data-active', 'true');

  await focusMonacoEditor(window);
  await window.keyboard.press('Control+W');

  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveCount(0);
  await expect(window.getByTestId('editor-tab-README.md')).toHaveAttribute('data-active', 'true');

  await app.close();
});

test('ctrl+tab cycles tabs to the right within the focused editor group', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_cpu_top_sv',
  ], { finalAction: 'dblclick' });
  await expect(window.getByTestId('file-tree-node-rtl_core_reg_file_v')).toBeVisible();
  await window.getByTestId('file-tree-node-rtl_core_reg_file_v').dblclick();

  await window.keyboard.press('Control+P');
  const quickOpenInput = window.getByTestId('quick-open-input');
  await quickOpenInput.fill('giti');
  await expect(window.getByTestId('quick-open-result-_gitignore')).toBeVisible();
  await quickOpenInput.press('Enter');

  await expect(window.getByTestId('editor-tab-.gitignore')).toBeVisible();
  await window.getByTestId('editor-tab-rtl/core/reg_file.v').click();
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveAttribute('data-active', 'true');

  await focusMonacoEditor(window);
  await window.keyboard.press('Control+Tab');
  await expect(window.getByTestId('editor-tab-.gitignore')).toHaveAttribute('data-active', 'true');
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveAttribute('data-active', 'false');

  await window.keyboard.press('Control+Tab');
  await expect(window.getByTestId('editor-tab-rtl/core/cpu_top.sv')).toHaveAttribute('data-active', 'true');
  await expect(window.getByTestId('editor-tab-.gitignore')).toHaveAttribute('data-active', 'false');

  await app.close();
});

test('ctrl+shift+tab cycles tabs to the left within the focused editor group', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_cpu_top_sv',
  ], { finalAction: 'dblclick' });
  await expect(window.getByTestId('file-tree-node-rtl_core_reg_file_v')).toBeVisible();
  await window.getByTestId('file-tree-node-rtl_core_reg_file_v').dblclick();

  await window.keyboard.press('Control+P');
  const quickOpenInput = window.getByTestId('quick-open-input');
  await quickOpenInput.fill('giti');
  await expect(window.getByTestId('quick-open-result-_gitignore')).toBeVisible();
  await quickOpenInput.press('Enter');

  await expect(window.getByTestId('editor-tab-.gitignore')).toHaveAttribute('data-active', 'true');

  await focusMonacoEditor(window);
  await window.keyboard.press('Control+Shift+Tab');
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toHaveAttribute('data-active', 'true');
  await expect(window.getByTestId('editor-tab-.gitignore')).toHaveAttribute('data-active', 'false');

  await window.getByTestId('editor-tab-rtl/core/cpu_top.sv').click();
  await expect(window.getByTestId('editor-tab-rtl/core/cpu_top.sv')).toHaveAttribute('data-active', 'true');

  await focusMonacoEditor(window);
  await window.keyboard.press('Control+Shift+Tab');
  await expect(window.getByTestId('editor-tab-.gitignore')).toHaveAttribute('data-active', 'true');
  await expect(window.getByTestId('editor-tab-rtl/core/cpu_top.sv')).toHaveAttribute('data-active', 'false');

  await app.close();
});

test('terminal tab creates a real shell session and shows command output', async () => {
  const { app, window } = await launchApp();
  const marker = '__PRISTINE_TERMINAL_E2E__';

  await openBottomTerminal(window);

  const bottomPanelTabBar = window.getByTestId('bottom-panel-tab-bar');
  await expect(bottomPanelTabBar).not.toHaveClass(/(?:^|\s)bg-muted\/40(?:\s|$)/);
  await expect(bottomPanelTabBar).toHaveClass(/(?:^|\s)bg-ide-tab-bg(?:\s|$)/);
  await expect(bottomPanelTabBar).toHaveClass(/(?:^|\s)border-b(?:\s|$)/);
  await expect(bottomPanelTabBar).toHaveClass(/(?:^|\s)border-ide-border(?:\s|$)/);
  await expectCompactPanelTabButton(getBottomPanelTab(window, 'terminal'));
  await expectCompactPanelTabButton(getBottomPanelTab(window, 'output'));
  await expectCompactPanelTabButton(getBottomPanelTab(window, 'schematic'));
  await expectCompactPanelTabButton(getBottomPanelTab(window, 'waveform'));

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

test('waveform bottom panel renders binary waveform and controls', async () => {
  test.slow();

  const { app, window } = await launchApp();

  await openBottomTerminal(window);
  await getBottomPanelTab(window, 'waveform').click();

  const panel = window.getByTestId('waveform-panel');
  const toolbar = window.getByTestId('waveform-toolbar');
  const toolbarActions = window.getByTestId('waveform-toolbar-actions');
  const cursorInfo = window.getByTestId('waveform-toolbar-cursor-info');
  const cursorInfoTime = window.getByTestId('waveform-toolbar-cursor-time');
  const cursorInfoSignal = window.getByTestId('waveform-toolbar-cursor-signal');
  const cursorInfoValue = window.getByTestId('waveform-toolbar-cursor-value');
  await expect(panel).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect.poll(async () => JSON.stringify({
    error: await panel.getAttribute('data-waveform-error'),
    loadingText: await window.getByTestId('waveform-loading-state').textContent().catch(() => null),
    signalCount: await panel.getAttribute('data-signal-count'),
    status: await panel.getAttribute('data-waveform-session-status'),
  }), {
    message: 'waveform binary session should load catalog metadata',
    timeout: UI_READY_TIMEOUT_MS,
  }).toContain('"signalCount":"168"');
  await expect(panel).toHaveAttribute('data-waveform-source', 'lsp-binary', { timeout: UI_READY_TIMEOUT_MS });
  await expect(panel).toHaveAttribute('data-waveform-frame-version', '2', { timeout: UI_READY_TIMEOUT_MS });
  await expect(panel).toHaveAttribute('data-waveform-frame-protocol-version', '2', { timeout: UI_READY_TIMEOUT_MS });
  await expect(panel).toHaveAttribute('data-waveform-frame-truncated', 'false', { timeout: UI_READY_TIMEOUT_MS });
  await expect(panel).toHaveAttribute('data-waveform-empty-visible-signal-count', '0', { timeout: UI_READY_TIMEOUT_MS });
  await expect(panel).toHaveAttribute('data-prepared-range-start', '0.00', { timeout: UI_READY_TIMEOUT_MS });
  await expect(panel).toHaveAttribute('data-prepared-range-end', '200.00', { timeout: UI_READY_TIMEOUT_MS });
  await expect(panel).toHaveAttribute('data-visible-window-start', '0.00', { timeout: UI_READY_TIMEOUT_MS });
  await expect(panel).toHaveAttribute('data-visible-window-end', '200.00', { timeout: UI_READY_TIMEOUT_MS });
  await expect.poll(async () => Number(await panel.getAttribute('data-waveform-frame-segment-count') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => Number(await panel.getAttribute('data-interaction-frame-request-count') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect(panel).toHaveAttribute('data-ready', 'true', { timeout: UI_READY_TIMEOUT_MS });
  await expect(panel).toHaveAttribute('data-renderer', /^(webgpu|webgl)$/);
  await expect(panel).toHaveAttribute('data-selected-signal-id', 'tb_top_module1-clk');
  await expect(window.getByTestId('waveform-signal-value-tb_top_module1-clk')).not.toHaveText(/^x$/i);
  await expect(toolbarActions).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(cursorInfo).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(cursorInfoTime).toHaveText(/0\.0ns/);
  await expect.poll(async () => toolbar.evaluate((element) => {
    const markup = String((element as { innerHTML?: string }).innerHTML ?? '');
    const cursorIndex = markup.indexOf('waveform-toolbar-cursor-info');
    const actionsIndex = markup.indexOf('waveform-toolbar-actions');

    return cursorIndex !== -1 && actionsIndex !== -1 && cursorIndex < actionsIndex;
  }), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe(true);

  const canvasHost = window.getByTestId('waveform-canvas');
  const readCanvasNumber = async (attribute: string) => Number(await canvasHost.getAttribute(attribute) ?? '0');
  await expect(canvasHost).toHaveAttribute('data-renderer', /^(webgpu|webgl)$/);
  await expect(canvasHost).toHaveAttribute('data-layer-count', '4');
  await expect(canvasHost).toHaveAttribute('data-waveform-frame-version', '2');
  await expect(canvasHost).toHaveAttribute('data-waveform-frame-protocol-version', '2');
  await expect(canvasHost).toHaveAttribute('data-waveform-frame-truncated', 'false');
  await expect(canvasHost).toHaveAttribute('data-waveform-empty-visible-signal-count', '0');
  await expect(canvasHost).toHaveAttribute('data-prepared-range-start', '0.00');
  await expect(canvasHost).toHaveAttribute('data-prepared-range-end', '200.00');
  await expect.poll(async () => readCanvasNumber('data-interaction-frame-request-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => readCanvasNumber('data-waveform-frame-segment-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => readCanvasNumber('data-source-segment-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => readCanvasNumber('data-rendered-segment-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => readCanvasNumber('data-mesh-vertex-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThanOrEqual(0);
  await expect.poll(async () => readCanvasNumber('data-gpu-buffer-update-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => readCanvasNumber('data-gpu-layer-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => readCanvasNumber('data-gpu-draw-layer-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  expect(await readCanvasNumber('data-gpu-draw-layer-count')).toBeLessThanOrEqual(8);
  await expect.poll(async () => readCanvasNumber('data-gpu-vertex-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  const initialGpuVertexCount = await readCanvasNumber('data-gpu-vertex-count');
  const initialGpuBufferUpdateCount = await readCanvasNumber('data-gpu-buffer-update-count');
  const initialInteractionFrameRequestCount = await readCanvasNumber('data-interaction-frame-request-count');
  await expect.poll(async () => readCanvasNumber('data-label-pool-size'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThanOrEqual(0);
  await expect.poll(async () => readCanvasNumber('data-label-layout-cache-miss-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThanOrEqual(0);
  await expect.poll(async () => readCanvasNumber('data-label-layout-cache-hit-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThanOrEqual(0);
  await expect(canvasHost).toHaveAttribute('data-layer-names', 'background,content,status,operation');
  await expect(canvasHost).toHaveAttribute('data-header-background', 'opaque');
  await expect(canvasHost).toHaveAttribute('data-row-count', '171');
  await expect(canvasHost).toHaveAttribute('data-row-height', '30');
  await expect(canvasHost).toHaveAttribute('data-first-signal-lane-y', '52.00');
  await expect(canvasHost).toHaveAttribute('data-waveform-header-height', '22.00');
  await expect(canvasHost).toHaveAttribute('data-bus-hexagon-count');
  await expect(canvasHost).toHaveAttribute('data-x-state-count');
  await expect(canvasHost).toHaveAttribute('data-z-state-count');
  await expect(canvasHost).toHaveAttribute('data-x-state-block-count');
  await expect(canvasHost).toHaveAttribute('data-z-state-block-count');
  await expect(canvasHost).toHaveAttribute('data-pulse-fill-count');
  await expect.poll(async () => readCanvasNumber('data-render-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => readCanvasNumber('data-visible-row-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => readCanvasNumber('data-culled-row-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => readCanvasNumber('data-rendered-signal-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => {
    const drawnHorizontalSegmentCount = await readCanvasNumber('data-drawn-horizontal-segment-count');

    return drawnHorizontalSegmentCount > 0;
  }, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe(true);
  await expect(canvasHost).not.toHaveAttribute('data-dense-signal-count');
  await expect(canvasHost).not.toHaveAttribute('data-compact-signal-count');
  await expect(canvasHost).not.toHaveAttribute('data-detail-signal-count');
  await expect(canvasHost).not.toHaveAttribute('data-coalesced-segment-count');
  await expect.poll(async () => {
    const collapsedSegmentCount = await readCanvasNumber('data-collapsed-segment-count');
    const skippedHorizontalSegmentCount = await readCanvasNumber('data-skipped-horizontal-segment-count');
    const busFullHexagonCount = await readCanvasNumber('data-bus-full-hexagon-count');
    const busSpecialStateHexagonCount = await readCanvasNumber('data-bus-special-state-hexagon-count');
    const busSpecialStateLabelCount = await readCanvasNumber('data-bus-special-state-label-count');
    const busSpecialStateWidthAlignedLabelCount = await readCanvasNumber('data-bus-special-state-width-aligned-label-count');
    const busTruncatedLabelCount = await readCanvasNumber('data-bus-truncated-label-count');
    const busLabelDotReplacementCount = await readCanvasNumber('data-bus-label-dot-replacement-count');

    return Number.isFinite(collapsedSegmentCount)
      && Number.isFinite(skippedHorizontalSegmentCount)
      && await readCanvasNumber('data-drawn-horizontal-segment-count') > 0
      && busFullHexagonCount > 0
      && busSpecialStateHexagonCount > 0
      && busSpecialStateLabelCount > 0
      && busSpecialStateWidthAlignedLabelCount > 0
      && Number.isFinite(busTruncatedLabelCount)
      && busTruncatedLabelCount >= 0
      && Number.isFinite(busLabelDotReplacementCount)
      && busLabelDotReplacementCount >= 0;
  }, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe(true);
  await expect.poll(async () => {
    const sourceSegmentCount = await readCanvasNumber('data-source-segment-count');
    const renderedSegmentCount = await readCanvasNumber('data-rendered-segment-count');
    const renderResolution = await readCanvasNumber('data-render-resolution');

    return sourceSegmentCount > 0 && renderedSegmentCount > 0 && renderResolution >= 1;
  }, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe(true);
  await expect(canvasHost.locator('canvas')).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect.poll(async () => readCanvasNumber('data-canvas-height'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThanOrEqual(waveformCanvasMinHeight);
  await expect.poll(async () => Number(await panel.getAttribute('data-last-render-ms') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => Number(await panel.getAttribute('data-visible-primitive-count') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect(panel).toHaveAttribute('data-gpu-hardware-acceleration', 'true');

  const resolvedRenderer = await canvasHost.getAttribute('data-renderer');

  if (resolvedRenderer === 'webgpu') {
    await expect(panel).toHaveAttribute('data-browser-webgpu', 'true');
  }

  if (resolvedRenderer === 'webgl') {
    await expect(panel).toHaveAttribute('data-browser-webgl2', 'true');
  }

  const canvasBox = await canvasHost.boundingBox();
  const innerCanvasBox = await canvasHost.locator('canvas').boundingBox();
  if (!canvasBox || !innerCanvasBox) {
    throw new Error('Expected waveform canvas geometry to be measurable');
  }

  expect(canvasBox.height).toBeGreaterThanOrEqual(waveformCanvasMinHeight);
  expect(Math.abs(innerCanvasBox.height - canvasBox.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(innerCanvasBox.width - canvasBox.width)).toBeLessThanOrEqual(2);

  const signalPanel = window.getByTestId('panel-waveform-signal-list');
  const resizeHandle = window.getByTestId('waveform-signal-list-resize-handle');
  const countingPrimary = window.getByTestId('waveform-signal-primary-u_top_module1-counting');
  await expect(signalPanel).toHaveAttribute('data-default-size', '10');
  const signalPanelBox = await signalPanel.boundingBox();
  const resizeHandleBox = await resizeHandle.boundingBox();

  if (!signalPanelBox || !resizeHandleBox) {
    throw new Error('Expected waveform signal panel resize geometry to be measurable');
  }

  expect(signalPanelBox.width).toBeGreaterThan(0);
  expect(resizeHandleBox.width).toBeGreaterThan(0);

  await window.mouse.move(resizeHandleBox.x + resizeHandleBox.width / 2, resizeHandleBox.y + resizeHandleBox.height / 2);
  await window.mouse.down();
  await window.mouse.move(resizeHandleBox.x + resizeHandleBox.width / 2 + 72, resizeHandleBox.y + resizeHandleBox.height / 2);
  await window.mouse.up();
  await expect.poll(async () => (await signalPanel.boundingBox())?.width ?? 0, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(signalPanelBox.width + 24);

  const alignedSecondGroupRow = window.getByTestId('waveform-signal-row-u_top_module1-clk');
  await expect(alignedSecondGroupRow).toHaveAttribute('data-row-index', '6');
  await expect(alignedSecondGroupRow).toHaveAttribute('data-lane-y', '202.00');
  const alignedSecondGroupRowBox = await alignedSecondGroupRow.boundingBox();
  if (!alignedSecondGroupRowBox) {
    throw new Error('Expected second group waveform signal row geometry to be measurable');
  }

  const alignedSecondGroupLaneY = Number(await alignedSecondGroupRow.getAttribute('data-lane-y') ?? 'NaN');
  expect(Number.isFinite(alignedSecondGroupLaneY)).toBe(true);
  expect(Math.abs(alignedSecondGroupRowBox.y - canvasBox.y - alignedSecondGroupLaneY)).toBeLessThanOrEqual(2);

  const countingRow = window.getByTestId('waveform-signal-row-u_top_module1-counting');
  await countingRow.click();
  await expect(panel).toHaveAttribute('data-selected-signal-id', 'u_top_module1-counting');
  await expect(countingRow).toHaveAttribute('data-row-index', '9');
  await expect(countingRow).toHaveAttribute('data-lane-y', '292.00');
  await expect(countingRow).toHaveClass(/items-end/);
  await expect(countingPrimary).toHaveClass(/items-center/);
  await expect(window.getByTestId('waveform-signal-value-u_top_module1-counting')).toHaveClass(/h-\[14px\]/);
  await expect(window.getByTestId('waveform-signal-value-u_top_module1-counting')).toHaveClass(/items-end/);
  await expect(window.getByTestId('waveform-signal-value-u_top_module1-counting')).toHaveClass(/justify-end/);
  await expect(canvasHost).toHaveAttribute('data-selected-signal-lane-y', '292.00');
  await expect(cursorInfoSignal).toHaveText(/counting/);
  await expect(cursorInfoValue).toHaveText(/^[0-9a-fxz]+$/i);

  await canvasHost.click({ position: { x: Math.floor(canvasBox.width * 0.28), y: 86 } });
  await expect.poll(async () => Number(await panel.getAttribute('data-cursor-time') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect(canvasHost).toHaveAttribute('data-cursor-visible', 'true');
  await expect(cursorInfoTime).toHaveText(/\d+\.\dns/);
  const cursorTimeAfterClick = Number(await panel.getAttribute('data-cursor-time') ?? '0');

  const initialZoom = Number(await panel.getAttribute('data-zoom') ?? '0');
  const zoomInButton = window.getByTestId('waveform-zoom-in');
  await zoomInButton.click();
  await expect.poll(async () => Number(await panel.getAttribute('data-zoom') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(initialZoom);
  for (let index = 0; index < 4; index += 1) {
    await zoomInButton.click();
  }
  const horizontalScrollbar = window.getByTestId('waveform-horizontal-scrollbar');
  const setHorizontalScrollbarLeft = async (scrollLeft: number) => {
    await horizontalScrollbar.evaluate(async (element, nextScrollLeft) => {
      const scrollable = element as unknown as {
        dispatchEvent: (event: Event) => boolean;
        scrollLeft: number;
      };
      const dispatchScroll = () => {
        scrollable.scrollLeft = nextScrollLeft;
        scrollable.dispatchEvent(new Event('scroll', { bubbles: true }));
      };
      dispatchScroll();
      await new Promise<void>((resolve) => setTimeout(resolve, 16));
      dispatchScroll();
    }, scrollLeft);
    await expect.poll(async () => {
      const actualScrollLeft = Number(await horizontalScrollbar.getAttribute('data-horizontal-scroll-left') ?? '0');
      return Math.abs(actualScrollLeft - scrollLeft);
    }, {
      timeout: UI_READY_TIMEOUT_MS,
    }).toBeLessThanOrEqual(1);
  };
  await expect.poll(async () => Number(await horizontalScrollbar.getAttribute('data-horizontal-scroll-range') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect(canvasHost).toHaveAttribute('data-ruler-scroll-indicator-color', '#8e8e8e');
  await expect(canvasHost).toHaveAttribute('data-ruler-scroll-indicator-height', '22.00');
  await expect(canvasHost).toHaveAttribute('data-ruler-scroll-indicator-radius', '3.00');
  await expect(canvasHost).toHaveAttribute('data-ruler-scroll-indicator-scrollable', 'true');
  await expect(canvasHost).toHaveClass(/cursor-default/);
  await expect(canvasHost).not.toHaveClass(/cursor-crosshair/);
  await expect.poll(async () => readCanvasNumber('data-ruler-scroll-indicator-width'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeLessThan(canvasBox.width);

  const startBeforeShiftWheel = Number(await panel.getAttribute('data-visible-window-start') ?? '0');
  const horizontalScrollLeftBeforeShiftWheel = Number(await horizontalScrollbar.getAttribute('data-horizontal-scroll-left') ?? '0');
  const rulerLeftBeforeShiftWheel = Number(await canvasHost.getAttribute('data-ruler-scroll-indicator-left') ?? '0');
  await canvasHost.hover();
  await window.keyboard.down('Shift');
  await window.mouse.wheel(0, 160);
  await window.keyboard.up('Shift');
  await expect.poll(async () => Number(await panel.getAttribute('data-visible-window-start') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(startBeforeShiftWheel);
  await expect.poll(async () => readCanvasNumber('data-display-viewport-update-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => readCanvasNumber('data-gpu-buffer-update-count'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(initialGpuBufferUpdateCount);
  expect(await readCanvasNumber('data-interaction-frame-request-count')).toBeLessThanOrEqual(initialInteractionFrameRequestCount + 2);
  expect(await readCanvasNumber('data-gpu-vertex-count')).toBeGreaterThan(0);
  expect(await readCanvasNumber('data-gpu-vertex-count')).toBeLessThanOrEqual(initialGpuVertexCount * 4);
  await expect(canvasHost).toHaveAttribute('data-waveform-frame-truncated', 'false');
  await expect(canvasHost).toHaveAttribute('data-waveform-empty-visible-signal-count', '0');
  await expect.poll(async () => Number(await canvasHost.getAttribute('data-ruler-scroll-indicator-left') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(rulerLeftBeforeShiftWheel);
  const maxHorizontalScrollLeft = Number(await horizontalScrollbar.getAttribute('data-horizontal-scroll-range') ?? '0');
  await setHorizontalScrollbarLeft(maxHorizontalScrollLeft);
  await expect.poll(async () => {
    const viewportStart = Number(await panel.getAttribute('data-visible-window-start') ?? '0');
    const viewportEnd = Number(await panel.getAttribute('data-visible-window-end') ?? '0');

    return cursorTimeAfterClick < viewportStart || cursorTimeAfterClick > viewportEnd;
  }, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe(true);
  await expect(canvasHost).toHaveAttribute('data-cursor-visible', 'false');
  await setHorizontalScrollbarLeft(horizontalScrollLeftBeforeShiftWheel);
  await expect.poll(async () => Number(await panel.getAttribute('data-visible-window-start') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeLessThanOrEqual(startBeforeShiftWheel + 1);
  await expect(canvasHost).toHaveAttribute('data-cursor-visible', 'true');
  await expect.poll(async () => {
    const viewportStart = Number(await panel.getAttribute('data-visible-window-start') ?? '0');
    const viewportEnd = Number(await panel.getAttribute('data-visible-window-end') ?? '0');
    const width = Number(await canvasHost.getAttribute('data-canvas-width') ?? '0');
    const expectedX = 10 + (cursorTimeAfterClick - viewportStart) / Math.max(8, viewportEnd - viewportStart) * Math.max(1, width - 20);
    const actualX = Number(await canvasHost.getAttribute('data-cursor-x') ?? 'NaN');

    return Math.abs(actualX - expectedX);
  }, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeLessThanOrEqual(1.5);

  const startBeforeRulerDrag = Number(await panel.getAttribute('data-visible-window-start') ?? '0');
  const horizontalScrollLeftBeforeRulerDrag = Number(await horizontalScrollbar.getAttribute('data-horizontal-scroll-left') ?? '0');
  const rulerLeftBeforeDrag = Number(await canvasHost.getAttribute('data-ruler-scroll-indicator-left') ?? '0');
  const rulerWidthBeforeDrag = Number(await canvasHost.getAttribute('data-ruler-scroll-indicator-width') ?? '0');
  const rulerCanvasBox = await canvasHost.boundingBox();
  if (!rulerCanvasBox) {
    throw new Error('Expected waveform canvas geometry before ruler drag to be measurable');
  }
  const rulerCenterY = rulerCanvasBox.y + Number(await canvasHost.getAttribute('data-waveform-header-height') ?? '22') / 2;
  const rulerStartX = rulerCanvasBox.x + rulerLeftBeforeDrag + Math.max(8, Math.min(rulerWidthBeforeDrag - 4, rulerWidthBeforeDrag / 2));
  await window.mouse.move(rulerStartX, rulerCenterY);
  await window.mouse.down();
  await window.mouse.move(rulerStartX - Math.max(90, rulerCanvasBox.width * 0.1), rulerCenterY);
  await window.mouse.up();
  await expect.poll(async () => Number(await panel.getAttribute('data-visible-window-start') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeLessThan(startBeforeRulerDrag);
  await expect.poll(async () => Number(await horizontalScrollbar.getAttribute('data-horizontal-scroll-left') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeLessThan(horizontalScrollLeftBeforeRulerDrag);

  const zoomBeforeCtrlWheel = Number(await panel.getAttribute('data-zoom') ?? '0');
  await window.keyboard.down('Control');
  await window.mouse.wheel(0, -160);
  await window.keyboard.up('Control');
  await expect.poll(async () => Number(await panel.getAttribute('data-zoom') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(zoomBeforeCtrlWheel);

  await window.getByTestId('waveform-fit').click();
  await expect(panel).toHaveAttribute('data-zoom', '1.00');
  const fixedCanvasBox = await canvasHost.boundingBox();
  await canvasHost.hover();
  await window.mouse.wheel(0, 360);
  await expect.poll(async () => Number(await canvasHost.getAttribute('data-vertical-scroll-top') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  const fixedCanvasBoxAfterWheel = await canvasHost.boundingBox();

  if (!fixedCanvasBox || !fixedCanvasBoxAfterWheel) {
    throw new Error('Expected waveform canvas geometry after wheel to be measurable');
  }

  expect(Math.abs(fixedCanvasBoxAfterWheel.y - fixedCanvasBox.y)).toBeLessThanOrEqual(1);
  await window.getByTestId('waveform-settings').click();
  await expect(window.getByTestId('waveform-settings-popover')).toBeVisible();
  await expect(window.getByTestId('waveform-gpu-hardware-acceleration')).toHaveText('true');
  await expect(window.getByTestId('waveform-gpu-compositing-status')).not.toHaveText('pending');
  await expect(window.getByTestId('waveform-gpu-webgl-status')).not.toHaveText('pending');
  await expect(window.getByTestId('waveform-gpu-webgpu-status')).not.toHaveText('pending');
  await expect(window.getByTestId('waveform-add-signals')).toHaveCount(0);
  await expect(window.getByTestId('waveform-signal-picker')).toHaveCount(0);

  const denseRow = window.getByTestId('waveform-signal-row-dense-signal-40');
  await denseRow.scrollIntoViewIfNeeded();
  await denseRow.click();
  await expect(panel).toHaveAttribute('data-selected-signal-id', 'dense-signal-40');
  await expect(denseRow).toHaveAttribute('data-row-index', '50');
  await expect(denseRow).toHaveAttribute('data-lane-y', '1522.00');
  await expect(canvasHost).toHaveAttribute('data-selected-signal-lane-y', '1522.00');

  await expect.poll(async () => {
    const denseRowBox = await denseRow.boundingBox();
    const scrolledCanvasBox = await canvasHost.boundingBox();
    const selectedSignalLaneY = Number(await canvasHost.getAttribute('data-selected-signal-visible-y') ?? 'NaN');

    if (!denseRowBox || !scrolledCanvasBox || !Number.isFinite(selectedSignalLaneY)) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.abs(denseRowBox.y - scrolledCanvasBox.y - selectedSignalLaneY);
  }, { timeout: UI_READY_TIMEOUT_MS }).toBeLessThanOrEqual(2);

  await expect.poll(async () => {
    const scrolledCanvasBox = await canvasHost.boundingBox();
    const selectedSignalVisibleY = Number(await canvasHost.getAttribute('data-selected-signal-visible-y') ?? 'NaN');
    const rowHeight = Number(await canvasHost.getAttribute('data-row-height') ?? 'NaN');

    if (!scrolledCanvasBox || !Number.isFinite(selectedSignalVisibleY) || !Number.isFinite(rowHeight)) {
      return false;
    }

    return selectedSignalVisibleY >= 30 && selectedSignalVisibleY + rowHeight <= scrolledCanvasBox.height + 2;
  }, { timeout: UI_READY_TIMEOUT_MS }).toBe(true);

  await app.close();
});

test('asic schematic bottom panel renders Pixi layers with selection and hierarchy navigation', async () => {
  skipIfPristineEngineUnavailable();

  const cpuTopSource = [
    'module cpu_top(input logic clk, input logic rst_n, input logic [3:0] a, input logic [3:0] b, input logic sel, inout tri [3:0] pad, output logic [3:0] y);',
    '  logic [3:0] n1;',
    '  logic [3:0] n2;',
    '  logic [3:0] n3;',
    '  alu u_alu(.a(a), .b(b), .y(n1));',
    '  logic_child u_logic(.clk(clk), .rst_n(rst_n), .a(n1), .b(b), .sel(sel), .pad(pad), .y(n2));',
    '  and u_and(n3[0], a[0], b[0]);',
    '  assign n3 = sel ? n1 : (a | b);',
    '  assign y = n3;',
    'endmodule',
  ].join('\n');
  const aluSource = [
    'module alu(input logic [3:0] a, input logic [3:0] b, output logic [3:0] y);',
    '  assign y = a ^ b;',
    'endmodule',
  ].join('\n');
  const logicChildSource = [
    'module logic_child(input logic clk, input logic rst_n, input logic [3:0] a, input logic [3:0] b, input logic sel, inout tri [3:0] pad, output logic [3:0] y);',
    '  logic [3:0] gated;',
    '  assign pad = sel ? gated : 4\'bz;',
    '  assign gated = a & b;',
    '  assign y = sel ? gated : b;',
    'endmodule',
  ].join('\n');
  const altTopSource = [
    'module z_schematic_alt_top(input logic a, input logic b, output logic y);',
    '  assign y = a | b;',
    'endmodule',
  ].join('\n');
  const projectRoot = createWorkspaceCopyWithFiles('schematic-workspace', {
    'rtl/core/alu.sv': aluSource,
    'rtl/core/cpu_top.sv': cpuTopSource,
    'rtl/core/logic_child.sv': logicChildSource,
    'rtl/core/z_schematic_alt_top.sv': altTopSource,
  });
  const { app, window } = await launchApp({ projectRoot });

  await openBottomTerminal(window);
  await getBottomPanelTab(window, 'schematic').click();

  const panel = window.getByTestId('asic-schematic-panel');
  await expect(panel).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });
  await expect(panel).toHaveAttribute('data-ready', 'true', { timeout: UI_READY_TIMEOUT_MS });
  await expect(panel).toHaveAttribute('data-module-id', 'cpu_top');
  await expect(panel).toHaveAttribute('data-renderer', /^(webgpu|webgl)$/);
  await expect.poll(async () => Number(await panel.getAttribute('data-node-count') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => Number(await panel.getAttribute('data-edge-count') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);

  const canvasHost = window.getByTestId('asic-schematic-canvas');
  await expect(canvasHost).toHaveAttribute('data-ticker-active', 'false');
  await expect(canvasHost).toHaveAttribute('data-layer-count', '4');
  await expect(canvasHost).toHaveAttribute('data-layer-names', 'background,wire,component,interaction');
  await expect.poll(async () => Number(await canvasHost.getAttribute('data-render-count') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  const canvas = canvasHost.locator('canvas[data-schematic-canvas="true"]');
  await expect(canvas).toBeVisible({ timeout: UI_READY_TIMEOUT_MS });

  const canvasBox = await canvas.boundingBox();
  expect(canvasBox?.width ?? 0).toBeGreaterThan(100);
  expect(canvasBox?.height ?? 0).toBeGreaterThan(100);

  const readCamera = async () => ({
    x: Number(await panel.getAttribute('data-pan-x') ?? '0'),
    y: Number(await panel.getAttribute('data-pan-y') ?? '0'),
    zoom: Number(await panel.getAttribute('data-zoom') ?? '0'),
  });
  const readFirstModule = async () => ({
    id: await canvasHost.getAttribute('data-first-module-id'),
    x: Number(await canvasHost.getAttribute('data-first-module-center-x') ?? '0'),
    y: Number(await canvasHost.getAttribute('data-first-module-center-y') ?? '0'),
  });
  const readSecondModule = async () => ({
    id: await canvasHost.getAttribute('data-second-module-id'),
    x: Number(await canvasHost.getAttribute('data-second-module-center-x') ?? '0'),
    y: Number(await canvasHost.getAttribute('data-second-module-center-y') ?? '0'),
  });
  const readDrillableModule = async () => ({
    id: await canvasHost.getAttribute('data-drillable-module-id'),
    targetId: await canvasHost.getAttribute('data-drillable-module-target-id'),
    x: Number(await canvasHost.getAttribute('data-drillable-module-center-x') ?? '0'),
    y: Number(await canvasHost.getAttribute('data-drillable-module-center-y') ?? '0'),
  });
  const readModuleSnapshot = async () => JSON.parse(await canvasHost.getAttribute('data-module-node-snapshot') ?? '[]') as Array<{
    id: string;
    label: string;
    subtitle: string;
    type: string;
    cellKind: string;
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    canDrillDown: boolean;
  }>;
  const readLogicSnapshot = async () => JSON.parse(await canvasHost.getAttribute('data-logic-node-snapshot') ?? '[]') as Array<{
    id: string;
    name: string;
    subtitle: string;
    type: string;
    cellKind: string;
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  }>;
  const readPortSnapshot = async () => JSON.parse(await canvasHost.getAttribute('data-port-node-snapshot') ?? '[]') as Array<{
    id: string;
    name: string;
    subtitle: string;
    type: string;
    direction: string;
    centerX: number;
    centerY: number;
  }>;
  const readModulePortSnapshot = async () => JSON.parse(await canvasHost.getAttribute('data-module-port-snapshot') ?? '[]') as Array<{
    nodeId: string;
    portId: string;
    name: string;
    direction: string;
    side: string;
    x: number;
    y: number;
  }>;
  const readSelectedNodeHighlightSnapshot = async () => JSON.parse(await canvasHost.getAttribute('data-selected-node-highlight-snapshot') ?? '[]') as Array<{
    id: string;
    kind: string;
    outline: string;
    x: number;
    y: number;
    width: number;
    height: number;
    includesExternalLabel: boolean;
  }>;
  const readEdgeSnapshot = async () => JSON.parse(await canvasHost.getAttribute('data-edge-route-snapshot') ?? '[]') as Array<{
    id: string;
    isBus: boolean;
    signalWidth: number;
    style: 'bus' | 'signal';
    fromNodeId: string;
    toNodeId: string;
    hasHorizontalStubs: boolean;
    points: Array<{ x: number; y: number }>;
  }>;
  const getCanvasBox = async () => {
    const box = await canvas.boundingBox();

    expect(box).not.toBeNull();
    if (!box) {
      throw new Error('Expected schematic canvas bounding box.');
    }

    return box;
  };
  const worldToScreen = async (point: { x: number; y: number }) => {
    const box = await getCanvasBox();
    const currentCamera = await readCamera();

    return {
      x: box.x + currentCamera.x + point.x * currentCamera.zoom,
      y: box.y + currentCamera.y + point.y * currentCamera.zoom,
    };
  };
  const isPointInsideCanvas = async (point: { x: number; y: number }, margin = 8) => {
    const box = await getCanvasBox();

    return point.x >= box.x + margin
      && point.x <= box.x + box.width - margin
      && point.y >= box.y + margin
      && point.y <= box.y + box.height - margin;
  };
  const panCanvasTowardWorldPoint = async (worldPoint: { x: number; y: number }) => {
    const box = await getCanvasBox();
    const screenPoint = await worldToScreen(worldPoint);
    const targetPoint = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
    const deltaX = targetPoint.x - screenPoint.x;
    const deltaY = targetPoint.y - screenPoint.y;

    await window.mouse.move(targetPoint.x, targetPoint.y);
    if (Math.abs(deltaX) > 1) {
      try {
        await window.keyboard.down('Shift');
        await window.mouse.wheel(0, -deltaX);
      } finally {
        await window.keyboard.up('Shift');
      }
    }
    if (Math.abs(deltaY) > 1) {
      await window.mouse.wheel(0, -deltaY);
    }
  };
  const waitForCanvasInteractionIdle = async () => {
    await expect.poll(async () => {
      const activeDragNodeIds = await canvasHost.getAttribute('data-active-drag-node-ids');
      const marqueeActive = await canvasHost.getAttribute('data-marquee-active');
      const alignmentGuidesVisible = await canvasHost.getAttribute('data-alignment-guides-visible');

      return [
        activeDragNodeIds ? 'dragging' : 'idle',
        marqueeActive,
        alignmentGuidesVisible,
      ].join('|');
    }, {
      timeout: UI_READY_TIMEOUT_MS,
    }).toBe('idle|false|false');
  };
  const moveToDrillableModuleAndWaitForHover = async () => {
    let drillableModule = await readDrillableModule();
    expect(drillableModule.id).not.toBeNull();
    expect(drillableModule.targetId).not.toBeNull();

    let drillPoint = await worldToScreen(drillableModule);
    if (!await isPointInsideCanvas(drillPoint)) {
      await panCanvasTowardWorldPoint(drillableModule);
      await expect.poll(async () => {
        drillPoint = await worldToScreen(drillableModule);

        return await isPointInsideCanvas(drillPoint) ? 'inside' : 'outside';
      }, {
        timeout: UI_READY_TIMEOUT_MS,
      }).toBe('inside');
    }
    await window.mouse.move(drillPoint.x, drillPoint.y);

    await expect.poll(async () => {
      drillableModule = await readDrillableModule();
      if (!drillableModule.id || !drillableModule.targetId) {
        return 'missing-drillable-module';
      }

      drillPoint = await worldToScreen(drillableModule);
      await window.mouse.move(drillPoint.x, drillPoint.y);
      const hoverNodeId = await canvasHost.getAttribute('data-hover-node-id');
      if (hoverNodeId === drillableModule.id) {
        return 'hit';
      }

      const currentCamera = await readCamera();
      const canvasBox = await canvas.boundingBox();
      return [
        `hover:${hoverNodeId ?? 'none'}`,
        `expected:${drillableModule.id}`,
        `world:${drillableModule.x.toFixed(1)},${drillableModule.y.toFixed(1)}`,
        `screen:${drillPoint.x.toFixed(1)},${drillPoint.y.toFixed(1)}`,
        `camera:${currentCamera.x.toFixed(1)},${currentCamera.y.toFixed(1)},${currentCamera.zoom.toFixed(3)}`,
        `canvas:${canvasBox ? `${canvasBox.x.toFixed(1)},${canvasBox.y.toFixed(1)},${canvasBox.width.toFixed(1)},${canvasBox.height.toFixed(1)}` : 'missing'}`,
      ].join('|');
    }, {
      timeout: UI_READY_TIMEOUT_MS,
    }).toBe('hit');

    drillableModule = await readDrillableModule();
    drillPoint = await worldToScreen(drillableModule);

    return { drillableModule, drillPoint };
  };
  const clickModule = async (module: { x: number; y: number }, ctrlKey = false) => {
    const point = await worldToScreen(module);

    if (ctrlKey) {
      await window.keyboard.down('Control');
    }
    await window.mouse.click(point.x, point.y);
    if (ctrlKey) {
      await window.keyboard.up('Control');
    }
  };
  const clickWorldPoint = async (point: { x: number; y: number } | { centerX: number; centerY: number }, ctrlKey = false) => {
    const worldPoint = 'centerX' in point
      ? { x: point.centerX, y: point.centerY }
      : point;
    const screenPoint = await worldToScreen(worldPoint);

    if (ctrlKey) {
      await window.keyboard.down('Control');
    }
    await window.mouse.click(screenPoint.x, screenPoint.y);
    if (ctrlKey) {
      await window.keyboard.up('Control');
    }
  };
  const readFirstEdge = async () => ({
    id: await canvasHost.getAttribute('data-first-edge-id'),
    x: Number(await canvasHost.getAttribute('data-first-edge-center-x') ?? '0'),
    y: Number(await canvasHost.getAttribute('data-first-edge-center-y') ?? '0'),
  });
  const clickEdge = async (edge: { x: number; y: number }) => {
    const point = await worldToScreen(edge);

    await window.mouse.click(point.x, point.y);
  };
  const dragWorldRect = async (from: { x: number; y: number }, to: { x: number; y: number }, ctrlKey = false) => {
    const fromPoint = await worldToScreen(from);
    const toPoint = await worldToScreen(to);

    if (ctrlKey) {
      await window.keyboard.down('Control');
    }
    await window.mouse.move(fromPoint.x, fromPoint.y);
    await window.mouse.down();
    await window.mouse.move(toPoint.x, toPoint.y, { steps: 5 });
    await window.mouse.up();
    if (ctrlKey) {
      await window.keyboard.up('Control');
    }
  };
  const modulesOverlap = (first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }, gap = 24) => !(
    first.x + first.width + gap <= second.x
    || second.x + second.width + gap <= first.x
    || first.y + first.height + gap <= second.y
    || second.y + second.height + gap <= first.y
  );
  const findModuleOverlap = (
    selectedModules: Array<{ id: string; x: number; y: number; width: number; height: number }>,
    obstacleModules: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  ) => {
    for (const selectedModule of selectedModules) {
      for (const obstacleModule of obstacleModules) {
        if (modulesOverlap(selectedModule, obstacleModule)) {
          return `${selectedModule.id}->${obstacleModule.id}`;
        }
      }
    }

    return null;
  };
  const edgeIntersectsModule = (points: Array<{ x: number; y: number }>, module: { x: number; y: number; width: number; height: number }, gap = 14) => {
    const rect = {
      x: module.x - gap,
      y: module.y - gap,
      width: module.width + gap * 2,
      height: module.height + gap * 2,
    };
    const pointInside = (point: { x: number; y: number }) => point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height;
    const segmentIntersects = (start: { x: number; y: number }, end: { x: number; y: number }) => {
      if (pointInside(start) || pointInside(end)) {
        return true;
      }

      if (start.x === end.x) {
        return start.x >= rect.x && start.x <= rect.x + rect.width
          && Math.max(start.y, end.y) >= rect.y
          && Math.min(start.y, end.y) <= rect.y + rect.height;
      }

      if (start.y === end.y) {
        return start.y >= rect.y && start.y <= rect.y + rect.height
          && Math.max(start.x, end.x) >= rect.x
          && Math.min(start.x, end.x) <= rect.x + rect.width;
      }

      return false;
    };

    return points.slice(1).some((point, index) => segmentIntersects(points[index]!, point));
  };

  const idleRenderCount = Number(await canvasHost.getAttribute('data-render-count') ?? '0');
  await window.waitForTimeout(400);
  expect(Number(await canvasHost.getAttribute('data-render-count') ?? '0')).toBe(idleRenderCount);

  await canvas.hover();
  const zoomBefore = await readCamera();
  await window.keyboard.down('Control');
  await window.mouse.wheel(0, -240);
  await window.keyboard.up('Control');
  await expect.poll(async () => (await readCamera()).zoom, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(zoomBefore.zoom);
  await expect.poll(async () => Number(await canvasHost.getAttribute('data-render-count') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(idleRenderCount);
  await expect.poll(async () => Number(await canvasHost.getAttribute('data-label-scale') ?? '1'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeLessThanOrEqual(1);
  await expect(canvasHost).toHaveAttribute('data-text-renderer', 'bitmap');
  await expect(canvasHost).toHaveAttribute('data-text-font-status', 'bitmap-ready');
  await expect.poll(async () => Number(await canvasHost.getAttribute('data-text-resolution') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThanOrEqual(3);
  await expect(canvasHost).toHaveAttribute('data-grid-enabled', 'true');
  const runtimeGridSize = Number(await canvasHost.getAttribute('data-grid-size') ?? '0');
  expect(runtimeGridSize).toBeGreaterThan(0);
  await expect.poll(async () => Number(await canvasHost.getAttribute('data-grid-line-count') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect(canvasHost).toHaveAttribute('data-snap-to-grid', 'true');
  await expect(canvasHost).toHaveAttribute('data-alignment-guides-enabled', 'true');

  await canvas.focus();
  await expect(canvasHost).toHaveAttribute('data-keyboard-active', 'true');
  const keyboardPanBefore = await readCamera();
  await window.keyboard.press('ArrowRight');
  await expect.poll(async () => (await readCamera()).x, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeCloseTo(keyboardPanBefore.x - runtimeGridSize, 1);
  const shiftedKeyboardPanBefore = await readCamera();
  await window.keyboard.down('Shift');
  await window.keyboard.press('ArrowDown');
  await window.keyboard.up('Shift');
  await expect.poll(async () => (await readCamera()).y, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeCloseTo(shiftedKeyboardPanBefore.y - runtimeGridSize * 4, 1);

  const verticalPanBefore = await readCamera();
  await window.mouse.wheel(0, 120);
  await expect.poll(async () => (await readCamera()).y, {
    timeout: UI_READY_TIMEOUT_MS,
  }).not.toBe(verticalPanBefore.y);
  const verticalPanAfter = await readCamera();
  expect(verticalPanAfter.x).toBe(verticalPanBefore.x);

  const horizontalPanBefore = await readCamera();
  await window.keyboard.down('Shift');
  await window.mouse.wheel(0, 120);
  await window.keyboard.up('Shift');
  await expect.poll(async () => (await readCamera()).x, {
    timeout: UI_READY_TIMEOUT_MS,
  }).not.toBe(horizontalPanBefore.x);
  const horizontalPanAfter = await readCamera();
  expect(horizontalPanAfter.y).toBe(horizontalPanBefore.y);

  const renderCountBeforeFit = Number(await canvasHost.getAttribute('data-render-count') ?? '0');
  await window.getByLabel('Fit schematic').click();
  await expect.poll(async () => Number(await canvasHost.getAttribute('data-render-count') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(renderCountBeforeFit);

  const firstModule = await readFirstModule();
  const secondModule = await readSecondModule();
  expect(firstModule.id).not.toBeNull();
  expect(secondModule.id).not.toBeNull();
  await expect.poll(async () => (await readLogicSnapshot()).map((node) => node.cellKind).sort(), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toEqual(expect.arrayContaining(['and', 'mux', 'or']));
  const initialModuleSnapshot = await readModuleSnapshot();
  const initialLogicSnapshot = await readLogicSnapshot();
  await expect.poll(async () => (await readPortSnapshot()).map((node) => node.direction).sort(), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toEqual(expect.arrayContaining(['input', 'output', 'inout']));
  await expect.poll(async () => (await readModulePortSnapshot()).some((port) => port.direction === 'inout' && port.side === 'east'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe(true);
  expect((await readModuleSnapshot()).filter((node) => node.subtitle !== '' || node.label !== node.id || node.type.length === 0)).toEqual([]);
  expect((await readPortSnapshot()).filter((node) => node.subtitle !== '' || node.type !== node.direction)).toEqual([]);
  expect((await readPortSnapshot()).filter((port) => port.name.toLowerCase().includes('logic'))).toEqual([]);
  const smallestRegularModule = initialModuleSnapshot
    .filter((node) => !node.cellKind || node.cellKind === 'module')
    .sort((first, second) => first.width * first.height - second.width * second.height)[0];
  expect(smallestRegularModule).toBeDefined();
  expect(initialLogicSnapshot.length).toBeGreaterThan(0);
  if (smallestRegularModule) {
    initialLogicSnapshot.forEach((node) => {
      expect(node.width).toBeLessThanOrEqual(smallestRegularModule.width / 2);
      expect(node.width * node.height).toBeLessThan(smallestRegularModule.width * smallestRegularModule.height / 2);
    });
  }
  await expect(canvasHost).toHaveAttribute('data-module-label-placement', 'outside-top-center');
  await expect(canvasHost).toHaveAttribute('data-gate-port-label-count', '0');
  await expect(canvasHost).toHaveAttribute('data-logic-node-color-family', 'yellow');
  await expect(canvasHost).toHaveAttribute('data-logic-node-fill-color', /^#[0-9a-f]{6}$/);
  await expect(canvasHost).toHaveAttribute('data-logic-node-stroke-color', /^#[0-9a-f]{6}$/);
  await expect(canvasHost).toHaveAttribute('data-port-wire-misalignment-count', '0');
  await expect(canvasHost).toHaveAttribute('data-port-marker-count', '0');
  await expect(canvasHost).toHaveAttribute('data-edge-end-marker-count', '0');
  const firstEdge = await readFirstEdge();
  expect(firstEdge.id).not.toBeNull();
  await expect(canvasHost).toHaveAttribute('data-first-bus-edge-style', 'bus');
  await expect(canvasHost).toHaveAttribute('data-first-signal-edge-style', 'signal');

  await window.mouse.move((await worldToScreen(firstModule)).x, (await worldToScreen(firstModule)).y);
  await expect(canvasHost).toHaveAttribute('data-hover-node-label', `name:${firstModule.id}`);
  await expect(canvasHost).toHaveAttribute('data-hover-node-type', /^type:/);
  const firstPortNode = (await readPortSnapshot())[0];
  expect(firstPortNode).toBeDefined();
  if (firstPortNode) {
    const firstPortPoint = await worldToScreen({ x: firstPortNode.centerX, y: firstPortNode.centerY });
    await window.mouse.move(firstPortPoint.x, firstPortPoint.y);
    await expect(canvasHost).toHaveAttribute('data-hover-node-label', `name:${firstPortNode.name}`);
    await expect(canvasHost).toHaveAttribute('data-hover-node-type', `type:${firstPortNode.direction}`);
  }

  await clickModule(firstModule);
  await expect(panel).toHaveAttribute('data-selected-node-count', '1');
  await expect(panel).toHaveAttribute('data-selected-node-ids', firstModule.id ?? '');
  await expect(panel).toHaveAttribute('data-selected-edge-count', '0');
  await expect.poll(async () => readSelectedNodeHighlightSnapshot(), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toEqual([expect.objectContaining({
    id: firstModule.id,
    includesExternalLabel: false,
    kind: 'module',
    outline: expect.stringMatching(/^(logic-shape|module-body)$/),
  })]);

  await clickEdge(firstEdge);
  await expect(panel).toHaveAttribute('data-selected-edge-count', '1');
  await expect(canvasHost).toHaveAttribute('data-selected-edge-highlight-color', /^#[0-9a-f]{6}$/);
  await expect.poll(async () => {
    const selectedEdgeIds = (await panel.getAttribute('data-selected-edge-ids') ?? '').split(',').filter(Boolean);
    const knownEdgeIds = (await readEdgeSnapshot()).map((edge) => edge.id);

    return selectedEdgeIds.length === 1 && knownEdgeIds.includes(selectedEdgeIds[0] ?? '') ? 'selected' : 'missing';
  }, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe('selected');
  await expect(panel).toHaveAttribute('data-selected-node-count', '0');

  await clickModule(firstModule);
  await expect(panel).toHaveAttribute('data-selected-node-count', '1');
  await expect(panel).toHaveAttribute('data-selected-node-ids', firstModule.id ?? '');
  await expect(panel).toHaveAttribute('data-selected-edge-count', '0');

  const portSnapshots = await readPortSnapshot();
  const inputPortNode = portSnapshots.find((port) => port.direction === 'input');
  const outputPortNode = portSnapshots.find((port) => port.direction === 'output');
  const inoutPortNode = portSnapshots.find((port) => port.direction === 'inout');
  expect(inputPortNode).toBeDefined();
  expect(outputPortNode).toBeDefined();
  expect(inoutPortNode).toBeDefined();
  if (!inputPortNode || !outputPortNode || !inoutPortNode) {
    throw new Error('Expected input, output, and inout schematic IO port nodes.');
  }

  await clickWorldPoint(inputPortNode);
  await expect(panel).toHaveAttribute('data-selected-node-count', '1');
  await expect(panel).toHaveAttribute('data-selected-node-ids', inputPortNode.id);
  await expect.poll(async () => readSelectedNodeHighlightSnapshot(), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toEqual([expect.objectContaining({
    id: inputPortNode.id,
    includesExternalLabel: false,
    kind: 'port',
    outline: 'io-port',
  })]);
  await clickWorldPoint(outputPortNode);
  await expect(panel).toHaveAttribute('data-selected-node-ids', outputPortNode.id);
  await clickWorldPoint(inoutPortNode);
  await expect(panel).toHaveAttribute('data-selected-node-ids', inoutPortNode.id);

  await clickModule(firstModule);
  await expect(panel).toHaveAttribute('data-selected-node-count', '1');
  await expect(panel).toHaveAttribute('data-selected-node-ids', firstModule.id ?? '');
  await expect(panel).toHaveAttribute('data-selected-edge-count', '0');

  await clickModule(secondModule, true);
  await expect.poll(async () => (await panel.getAttribute('data-selected-node-ids') ?? '').split(',').filter(Boolean).sort(), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toEqual([firstModule.id, secondModule.id].filter(Boolean).sort());
  await expect(panel).toHaveAttribute('data-selected-node-count', '2');

  await clickModule(firstModule, true);
  await expect(panel).toHaveAttribute('data-selected-node-count', '1');
  await expect(panel).toHaveAttribute('data-selected-node-ids', secondModule.id ?? '');

  const snapshotBeforeMarquee = await readModuleSnapshot();
  const firstRect = snapshotBeforeMarquee.find((node) => node.id === firstModule.id);
  const secondRect = snapshotBeforeMarquee.find((node) => node.id === secondModule.id);
  expect(firstRect).toBeDefined();
  expect(secondRect).toBeDefined();
  if (!firstRect || !secondRect) {
    throw new Error('Expected two schematic modules for marquee selection.');
  }
  const marqueeRect = {
    x: firstRect.x - 8,
    y: firstRect.y - 8,
    width: firstRect.width + 16,
    height: firstRect.height + 16,
  };

  await dragWorldRect({ x: marqueeRect.x, y: marqueeRect.y }, { x: marqueeRect.x + marqueeRect.width, y: marqueeRect.y + marqueeRect.height });
  await expect(panel).toHaveAttribute('data-selected-node-count', '1');
  await expect(panel).toHaveAttribute('data-selected-node-ids', firstModule.id ?? '');
  await expect(canvasHost).toHaveAttribute('data-marquee-active', 'false');

  await dragWorldRect({ x: marqueeRect.x, y: marqueeRect.y }, { x: marqueeRect.x + marqueeRect.width, y: marqueeRect.y + marqueeRect.height }, true);
  await expect(panel).toHaveAttribute('data-selected-node-count', '0');

  await clickModule(firstModule);
  await clickModule(secondModule, true);
  await expect(panel).toHaveAttribute('data-selected-node-count', '2');

  const selectedNodeIds = [firstModule.id, secondModule.id].filter((nodeId): nodeId is string => Boolean(nodeId)).sort();
  const snapshotBeforeDrag = await readModuleSnapshot();
  const dragSource = snapshotBeforeDrag.find((node) => node.id === firstModule.id);
  const dragObstacle = snapshotBeforeDrag.find((node) => !selectedNodeIds.includes(node.id));
  expect(dragSource).toBeDefined();
  expect(dragObstacle).toBeDefined();
  if (!dragSource || !dragObstacle) {
    throw new Error('Expected selected and unselected modules for group drag.');
  }
  const edgeCountBeforeDrag = await panel.getAttribute('data-edge-count');
  const renderCountBeforeDrag = Number(await canvasHost.getAttribute('data-render-count') ?? '0');

  const dragStartPoint = await worldToScreen({ x: dragSource.centerX, y: dragSource.centerY });
  const dragEndPoint = await worldToScreen({ x: dragObstacle.centerX, y: dragObstacle.centerY });

  await window.mouse.move(dragStartPoint.x, dragStartPoint.y);
  await window.mouse.down();
  await window.mouse.move(dragEndPoint.x, dragEndPoint.y, { steps: 5 });
  await expect.poll(async () => Number(await canvasHost.getAttribute('data-active-drag-hidden-edge-count') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  await expect.poll(async () => (await canvasHost.getAttribute('data-active-drag-node-ids') ?? '').split(',').filter(Boolean).sort(), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toEqual(selectedNodeIds);
  await window.mouse.up();

  await expect(canvasHost).toHaveAttribute('data-last-drag-node-id', selectedNodeIds[0] ?? '');
  await expect.poll(async () => (await canvasHost.getAttribute('data-last-drag-node-ids') ?? '').split(',').filter(Boolean).sort(), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toEqual(selectedNodeIds);
  await expect.poll(async () => {
    const lastX = Number(await canvasHost.getAttribute('data-last-drag-node-x') ?? '0');
    const lastY = Number(await canvasHost.getAttribute('data-last-drag-node-y') ?? '0');

    return lastX !== dragSource.x || lastY !== dragSource.y;
  }, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe(true);
  expect(Math.abs(Number(await canvasHost.getAttribute('data-last-drag-node-x') ?? '0') % 40)).toBe(0);
  expect(Math.abs(Number(await canvasHost.getAttribute('data-last-drag-node-y') ?? '0') % 40)).toBe(0);
  await expect.poll(async () => Number(await canvasHost.getAttribute('data-render-count') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(renderCountBeforeDrag);
  await expect(panel).toHaveAttribute('data-edge-count', edgeCountBeforeDrag ?? '');
  await expect.poll(async () => {
    const snapshot = await readModuleSnapshot();
    const movedSelectedNodes = snapshot.filter((node) => selectedNodeIds.includes(node.id));
    const obstacleNodes = snapshot.filter((node) => !selectedNodeIds.includes(node.id));
    const overlap = findModuleOverlap(movedSelectedNodes, obstacleNodes);

    return overlap ? `overlap:${overlap}` : 'clear';
  }, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe('clear');
  await expect.poll(async () => {
    const modules = await readModuleSnapshot();
    const edges = await readEdgeSnapshot();

    return edges.every((edge) => {
      return modules.every((module) => {
        if (module.id === edge.fromNodeId || module.id === edge.toNodeId) {
          return true;
        }

        return !edgeIntersectsModule(edge.points, module);
      });
    }) ? 'clear' : 'blocked';
  }, {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe('clear');
  await expect.poll(async () => (await readEdgeSnapshot()).every((edge) => edge.hasHorizontalStubs), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe(true);
  await expect(canvasHost).toHaveAttribute('data-port-wire-misalignment-count', '0');

  await waitForCanvasInteractionIdle();
  await expect.poll(async () => Number(await panel.getAttribute('data-layout-cache-size') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(1);
  const { drillableModule, drillPoint } = await moveToDrillableModuleAndWaitForHover();
  await window.mouse.dblclick(drillPoint.x, drillPoint.y);
  await expect.poll(async () => await panel.getAttribute('data-module-id'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBe(drillableModule.targetId ?? '');

  await window.getByLabel('Parent module').click();
  await expect(panel).toHaveAttribute('data-module-id', 'cpu_top');
  await window.getByLabel('Next child module').click();
  await expect(panel).toHaveAttribute('data-module-id', drillableModule.targetId ?? '');

  await window.getByLabel('Root module').click();
  await expect(panel).toHaveAttribute('data-module-id', 'cpu_top');

  await expect(panel).toHaveAttribute('data-ready', 'true');
  await expect.poll(async () => Number(await canvasHost.getAttribute('data-render-count') ?? '0'), {
    timeout: UI_READY_TIMEOUT_MS,
  }).toBeGreaterThan(0);
  const postDragIdleRenderCount = Number(await canvasHost.getAttribute('data-render-count') ?? '0');
  await window.waitForTimeout(400);
  expect(Number(await canvasHost.getAttribute('data-render-count') ?? '0')).toBe(postDragIdleRenderCount);

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

  await openBottomTerminal(window);

  await expect.poll(async () => readTerminalPid(window), {
    timeout: 15000,
  }).toBeGreaterThan(0);

  const originalPid = await readTerminalPid(window);
  expect(isProcessRunning(originalPid)).toBe(true);

  await getBottomPanelTab(window, 'output').click();
  await expect(window.getByTestId('terminal-host')).toHaveCount(0);
  expect(isProcessRunning(originalPid)).toBe(true);

  await getBottomPanelTab(window, 'terminal').click();
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

test('terminal bottom panel maximizes, snaps, and auto-hides without closing the session', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await openBottomTerminal(window);

  await expect.poll(async () => readTerminalPid(window), {
    timeout: 15000,
  }).toBeGreaterThan(0);

  const originalPid = await readTerminalPid(window);
  const bottomPanel = window.getByTestId('panel-bottom-panel');
  const centerPanel = window.getByTestId('panel-center-panel');
  const bottomResizeHandle = window.locator('[data-slot="resizable-handle"]').last();

  async function dragBottomPanelHandleTo(targetY: number) {
    const handleBox = await bottomResizeHandle.boundingBox();

    if (!handleBox) {
      throw new Error('Expected bottom panel resize handle geometry to be measurable');
    }

    await window.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await window.mouse.down();
    await window.mouse.move(handleBox.x + handleBox.width / 2, targetY, { steps: 12 });
    await window.mouse.up();
  }

  async function dragBottomPanelHandleToMaxSnap(targetY: number) {
    const fallbackTargets = [targetY, Math.max(targetY - 16, 0), Math.max(targetY - 32, 0)];

    for (const fallbackTargetY of fallbackTargets) {
      await dragBottomPanelHandleTo(fallbackTargetY);

      try {
        await expect(bottomPanel).toHaveAttribute('data-bottom-panel-maximized', 'true', { timeout: 1000 });
        return;
      } catch {
        // CI runners can release a few pixels shy of the snap threshold.
      }
    }

    await expect(bottomPanel).toHaveAttribute('data-bottom-panel-maximized', 'true');
  }

  const initialBottomHeight = await readElementPixelHeight(bottomPanel);
  const maximizeButton = window.getByTestId('bottom-panel-maximize');

  await expect(maximizeButton).toHaveAccessibleName('Maximize Panel');
  await maximizeButton.click();
  await expect(maximizeButton).toHaveAccessibleName('Restore Panel');
  await expect(bottomPanel).toHaveAttribute('data-bottom-panel-maximized', 'true');
  await expect.poll(async () => {
    const [bottomHeight, centerHeight] = await Promise.all([
      readElementPixelHeight(bottomPanel),
      readElementPixelHeight(centerPanel),
    ]);

    return bottomHeight >= centerHeight - 40;
  }, { timeout: UI_READY_TIMEOUT_MS }).toBe(true);

  await maximizeButton.click();
  await expect(maximizeButton).toHaveAccessibleName('Maximize Panel');
  await expect(bottomPanel).toHaveAttribute('data-bottom-panel-maximized', 'false');
  await expect.poll(async () => readElementPixelHeight(bottomPanel), { timeout: UI_READY_TIMEOUT_MS }).toBeLessThan(initialBottomHeight + 80);

  const centerBoxBeforeMaxSnap = await centerPanel.boundingBox();
  if (!centerBoxBeforeMaxSnap) {
    throw new Error('Expected center panel geometry to be measurable');
  }

  await dragBottomPanelHandleToMaxSnap(centerBoxBeforeMaxSnap.y + 4);
  await expect(maximizeButton).toHaveAccessibleName('Restore Panel');
  await expect.poll(async () => {
    const [bottomHeight, centerHeight] = await Promise.all([
      readElementPixelHeight(bottomPanel),
      readElementPixelHeight(centerPanel),
    ]);

    return bottomHeight >= centerHeight - 40;
  }, { timeout: UI_READY_TIMEOUT_MS }).toBe(true);

  const centerBoxBeforeHideSnap = await centerPanel.boundingBox();
  if (!centerBoxBeforeHideSnap) {
    throw new Error('Expected center panel geometry to be measurable before hiding');
  }

  await dragBottomPanelHandleTo(centerBoxBeforeHideSnap.y + centerBoxBeforeHideSnap.height - 4);
  await expectCollapsedPanel(bottomPanel);
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

  await getBottomPanelTab(window, 'output').click();
  await expect(window.getByTestId('terminal-host')).toHaveCount(0);

  await window.getByTestId('toggle-bottom-panel').click();
  await expect(window.getByTestId('terminal-host')).toHaveCount(0);

  await window.getByTestId('toggle-bottom-panel').click();
  await getBottomPanelTab(window, 'terminal').click();
  await openBottomTerminal(window);

  await expect.poll(async () => readTerminalText(window), {
    timeout: 15000,
  }).toContain(marker);

  await app.close();
});

test('terminal remains writable after left sidebar toggles while vertically scrolled', async () => {
  test.skip(Boolean(process.env['CI']), 'Skipped in CI while terminal scroll/toggle stability is under investigation');
  test.slow();

  const { app, window } = await launchApp();
  const bottomPanel = window.getByTestId('panel-bottom-panel');
  const scrollCommand = createTerminalScrollFloodCommand('__PRISTINE_SCROLL__', 120);
  const scrollMarker = '__PRISTINE_SCROLL__120';
  const afterToggleMarker = '__PRISTINE_AFTER_LEFT_TOGGLE__';

  await ensureExplorerVisible(window);
  await openBottomTerminal(window);

  await expect.poll(async () => readTerminalPid(window), {
    timeout: 15000,
  }).toBeGreaterThan(0);

  const bottomResizeHandle = window.locator('[data-slot="resizable-handle"]').last();
  const bottomResizeHandleBox = await bottomResizeHandle.boundingBox();

  if (!bottomResizeHandleBox) {
    throw new Error('Expected bottom panel resize handle geometry to be measurable');
  }

  await window.mouse.move(
    bottomResizeHandleBox.x + bottomResizeHandleBox.width / 2,
    bottomResizeHandleBox.y + bottomResizeHandleBox.height / 2,
  );
  await window.mouse.down();
  await window.mouse.move(
    bottomResizeHandleBox.x + bottomResizeHandleBox.width / 2,
    bottomResizeHandleBox.y + bottomResizeHandleBox.height / 2 + 180,
    { steps: 12 },
  );
  await window.mouse.up();

  await expect.poll(async () => bottomPanel.evaluate((element) => {
    const panel = element as { getBoundingClientRect: () => { height: number } };
    return Math.round(panel.getBoundingClientRect().height);
  })).toBeLessThan(170);

  await writeTerminalCommand(window, scrollCommand);

  await expect.poll(async () => readTerminalText(window), {
    timeout: 20000,
  }).toContain(scrollMarker);

  await expect.poll(async () => readScrollbarWidthSnapshot(window), {
    timeout: 10000,
  }).toEqual({
    explorerWidth: '6px',
    ready: true,
    terminalCustomScrollbarMatchesSurface: true,
    terminalCustomScrollbarWidth: '6px',
    terminalCustomSliderWidth: '6px',
    terminalViewportWidth: '6px',
  });

  await window.getByTestId('toggle-left-panel').click();
  await expectCollapsedPanel(window.getByTestId('panel-left-panel'));
  await waitForTerminalLayoutSettled(window);

  await window.getByTestId('toggle-left-panel').click();
  await expect(window.getByTestId('panel-left-panel')).toBeVisible();
  await waitForTerminalLayoutSettled(window);

  await writeTerminalCommand(window, `echo ${afterToggleMarker}`);

  await expect.poll(async () => readTerminalText(window), {
    timeout: 15000,
  }).toContain(afterToggleMarker);

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

test('menu bar avatar opens the account popover with desktop auth actions', async () => {
  const { app, window } = await launchApp();

  const userAvatarButton = window.getByTestId('user-avatar-button');
  await expect(userAvatarButton).toBeVisible();

  await userAvatarButton.click();
  await expect(window.getByTestId('user-account-popover')).toBeVisible();
  await expect(window.getByTestId('user-sign-in-button')).toBeVisible();
  await expect(window.getByTestId('user-sign-up-button')).toBeVisible();

  await app.close();
});

test('desktop auth session persists across app relaunch without eager refresh', async () => {
  const refreshRequests: string[] = [];
  const refreshServer = createServer((request, response) => {
    if (request.method === 'POST' && request.url?.startsWith('/auth/v1/token?grant_type=refresh_token')) {
      refreshRequests.push(request.url);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        access_token: `refreshed-access-token-${refreshRequests.length}`,
        expires_at: 2_000_000_000 + refreshRequests.length,
        refresh_token: `refreshed-refresh-token-${refreshRequests.length}`,
      }));
      return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: 'Not found' }));
  });

  await new Promise<void>((resolve) => {
    refreshServer.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = refreshServer.address() as AddressInfo;
  const supabaseUrl = `http://127.0.0.1:${port}`;

  const readDesktopSession = async (window: Page) => {
    return window.evaluate(async () => {
      const browserGlobal = globalThis as typeof globalThis & {
        electronAPI?: {
          auth: {
            getSession: () => Promise<{
              email: string;
              userId: string;
              username: string;
            } | null>;
          };
        };
      };

      return browserGlobal.electronAPI?.auth.getSession() ?? null;
    });
  };

  const assertSignedInPopover = async (window: Page) => {
    await expect.poll(async () => {
      return (await readDesktopSession(window))?.username ?? null;
    }).toBe('Alice');

    await window.getByTestId('user-avatar-button').click();
    await expect(window.getByTestId('user-account-popover')).toBeVisible();
    await expect(window.getByTestId('user-account-name')).toHaveText('Alice');
    await expect(window.getByTestId('user-sign-out-button')).toBeVisible();
    await expect(window.getByTestId('user-sign-in-button')).toHaveCount(0);
  };

  writeE2EAuthSession(createE2EStoredAuthSession());

  try {
    const firstLaunch = await launchApp({
      env: {
        PRISTINE_SUPABASE_URL: supabaseUrl,
      },
    });
    const { app: firstApp, window: firstWindow } = firstLaunch;

    await assertSignedInPopover(firstWindow);
    await expect.poll(() => refreshRequests.length).toBeGreaterThan(0);
    const refreshCountAfterFirstLaunch = refreshRequests.length;

    await firstApp.close();

    const secondLaunch = await launchApp({
      env: {
        PRISTINE_SUPABASE_URL: supabaseUrl,
      },
    });
    const { app: secondApp, window: secondWindow } = secondLaunch;

    await assertSignedInPopover(secondWindow);
    await secondWindow.waitForTimeout(1000);
    expect(refreshRequests.length).toBe(refreshCountAfterFirstLaunch);

    await secondApp.close();
  } finally {
    await new Promise<void>((resolve) => {
      refreshServer.close(() => resolve());
    });
  }
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
  await openSettingsPage(window, 'window');

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

test('floating info window expands on hover and updates live chart data', async () => {
  const { app, window } = await launchApp();

  await setFloatingInfoWindowVisibility(window, true);

  await expect.poll(async () => (await getWindowByTitle(app, 'Pristine Floating Info')) !== null).toBe(true);
  const floatingInfoWindow = await getWindowByTitle(app, 'Pristine Floating Info');

  if (!floatingInfoWindow) {
    throw new Error('Expected floating info window to be available');
  }

  const floatingInfoShell = floatingInfoWindow.getByTestId('floating-info-window');
  const collapsedBounds = await readBrowserWindowBounds(app, floatingInfoWindow);

  await expect(floatingInfoShell).toHaveAttribute('data-expanded', 'false');
  expect(collapsedBounds.width).toBe(60);
  expect(collapsedBounds.height).toBeGreaterThan(0);

  const initialLatestTime = await floatingInfoShell.getAttribute('data-latest-time');

  await floatingInfoShell.hover();

  await floatingInfoWindow.waitForTimeout(500);
  await expect(floatingInfoShell).toHaveAttribute('data-expanded', 'false');
  await expect(floatingInfoShell).toHaveAttribute('data-mode', 'collapsed');

  await expect(floatingInfoShell).toHaveAttribute('data-expanded', 'true');
  await expect(floatingInfoWindow.getByTestId('floating-info-chart')).toBeVisible();
  await expect(floatingInfoWindow.getByTestId('floating-info-expanded-drag-region')).toHaveAttribute('data-app-region', 'drag');
  await expect(floatingInfoWindow.getByTestId('floating-info-chart-shell')).toHaveAttribute('data-app-region', 'no-drag');
  await expect.poll(async () => (await readBrowserWindowBounds(app, floatingInfoWindow)).width).toBeGreaterThan(collapsedBounds.width);
  await expect.poll(async () => (await readBrowserWindowBounds(app, floatingInfoWindow)).height).toBeGreaterThan(collapsedBounds.height);
  await floatingInfoWindow.waitForTimeout(700);
  await expect(floatingInfoShell).toHaveAttribute('data-expanded', 'true');
  await expect(floatingInfoShell).toHaveAttribute('data-mode', 'expanded');
  await expect.poll(async () => floatingInfoShell.getAttribute('data-latest-time'), {
    timeout: 4000,
  }).not.toBe(initialLatestTime);

  await floatingInfoWindow.mouse.move(collapsedBounds.width + 320, collapsedBounds.height + 240);

  await expect.poll(async () => floatingInfoShell.getAttribute('data-expanded')).toBe('false');
  await expect.poll(async () => (await readBrowserWindowBounds(app, floatingInfoWindow)).width).toBe(collapsedBounds.width);
  await expect.poll(async () => (await readBrowserWindowBounds(app, floatingInfoWindow)).height).toBe(collapsedBounds.height);

  await app.close();
});

test('floating info window opens the static detail view on double click and returns on quit', async () => {
  const { app, window } = await launchApp();

  await setFloatingInfoWindowVisibility(window, true);

  await expect.poll(async () => (await getWindowByTitle(app, 'Pristine Floating Info')) !== null).toBe(true);
  const floatingInfoWindow = await getWindowByTitle(app, 'Pristine Floating Info');

  if (!floatingInfoWindow) {
    throw new Error('Expected floating info window to be available');
  }

  const floatingInfoShell = floatingInfoWindow.getByTestId('floating-info-window');
  const collapsedBounds = await readBrowserWindowBounds(app, floatingInfoWindow);

  await expect(floatingInfoShell).toHaveAttribute('data-mode', 'collapsed');

  await floatingInfoShell.dblclick();

  await expect(floatingInfoShell).toHaveAttribute('data-mode', 'detail');
  await expect(floatingInfoWindow.getByTestId('floating-info-detail')).toBeVisible();
  await expect(floatingInfoWindow.getByText('Pi Stats')).toBeVisible();
  await expect(floatingInfoWindow.getByText('RTL Files')).toBeVisible();
  await expect(floatingInfoWindow.getByText('Compile Activity')).toBeVisible();
  await expect(floatingInfoWindow.getByText('Top Design Unit')).toBeVisible();
  await expect(floatingInfoWindow.getByTestId('floating-info-detail-drag-region')).toHaveAttribute('data-app-region', 'drag');
  await expect(floatingInfoWindow.getByTestId('floating-info-detail-tab-simulation')).toBeVisible();
  await expect(floatingInfoWindow.getByTestId('floating-info-detail-tab-usage')).toHaveCount(0);
  await expect(floatingInfoWindow.getByTestId('floating-info-range-controls')).toHaveClass(/bg-muted\/75/);
  for (const label of ['1d', '2d', '7d', 'All']) {
    const rangeButton = floatingInfoWindow.getByTestId(`floating-info-range-${label.toLowerCase()}`);
    await expect(rangeButton).toHaveAttribute('aria-label', label);
    await expect(rangeButton).toHaveAttribute('title', label);
    const rangeBox = await rangeButton.boundingBox();
    const refreshBox = await floatingInfoWindow.getByTestId('floating-info-detail-refresh').boundingBox();

    expect(rangeBox?.width ?? 0).toBeCloseTo(refreshBox?.width ?? 0, 1);
    expect(rangeBox?.height ?? 0).toBeCloseTo(refreshBox?.height ?? 0, 1);
  }
  const settingsBox = await floatingInfoWindow.getByTestId('floating-info-detail-settings').boundingBox();
  const refreshBox = await floatingInfoWindow.getByTestId('floating-info-detail-refresh').boundingBox();
  expect(settingsBox?.width ?? 0).toBeCloseTo(refreshBox?.width ?? 0, 1);
  expect(settingsBox?.height ?? 0).toBeCloseTo(refreshBox?.height ?? 0, 1);
  await expect(floatingInfoWindow.getByTestId('floating-info-detail-content')).toHaveClass(/overflow-y-auto/);
  await expect.poll(async () => (await readBrowserWindowBounds(app, floatingInfoWindow)).width).toBe(360);
  await expect.poll(async () => (await readBrowserWindowBounds(app, floatingInfoWindow)).height).toBe(520);

  await floatingInfoWindow.getByTestId('floating-info-detail-tab-languages').click();
  await expect(floatingInfoWindow.getByText('SystemVerilog').first()).toBeVisible();
  await expect(floatingInfoWindow.getByText('181.1K')).toBeVisible();
  await expect(floatingInfoWindow.getByText('by HDL footprint')).toBeVisible();

  await floatingInfoWindow.getByTestId('floating-info-detail-tab-projects').click();
  await expect(floatingInfoWindow.getByText('retroSoC')).toBeVisible();
  await expect(floatingInfoWindow.getByText('xpi_core')).toBeVisible();

  await floatingInfoWindow.getByTestId('floating-info-detail-tab-models').click();
  await expect(floatingInfoWindow.getByText('Model & Tool Usage')).toBeVisible();
  await expect(floatingInfoWindow.getByText('Cache Read')).toBeVisible();
  await expect(floatingInfoWindow.getByText('Tool Calls')).toBeVisible();
  await expect.poll(async () => floatingInfoWindow.getByTestId('floating-info-detail-content').evaluate((element) => {
    const content = element as unknown as { clientHeight: number; scrollHeight: number };
    return content.scrollHeight > content.clientHeight;
  })).toBe(true);
  await expect(floatingInfoWindow.getByTestId('floating-info-detail-content')).toHaveClass(/\[scrollbar-width:none\]/);

  await floatingInfoWindow.getByTestId('floating-info-detail-tab-simulation').click();
  await expect(floatingInfoWindow.getByText('Recent Simulation')).toBeVisible();
  await expect(floatingInfoWindow.getByText('xpi_loopback')).toBeVisible();
  await expect(floatingInfoWindow.getByText('Waveform Session')).toBeVisible();
  await expect(floatingInfoWindow.getByTestId('floating-info-detail-shortcut')).toContainText('Q');

  await floatingInfoWindow.getByTestId('floating-info-detail-quit').click();

  await expect(floatingInfoShell).toHaveAttribute('data-mode', 'collapsed');
  await expect.poll(async () => (await readBrowserWindowBounds(app, floatingInfoWindow)).width).toBe(collapsedBounds.width);
  await expect.poll(async () => (await readBrowserWindowBounds(app, floatingInfoWindow)).height).toBe(collapsedBounds.height);

  await app.close();
});

test('tray and floating info settings persist across app relaunch', async () => {
  const firstLaunch = await launchApp();
  const { app: firstApp, window: firstWindow } = firstLaunch;

  await clearRememberedCloseBehavior(firstWindow);
  await setFloatingInfoWindowVisibility(firstWindow, false);

  await firstWindow.getByTestId('menu-settings-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toBeVisible();
  await openSettingsPage(firstWindow, 'window');

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
  await openSettingsPage(secondWindow, 'window');
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

test('settings UI theme selection persists across app relaunch', async () => {
  test.slow();

  const readThemeSnapshot = async (page: Awaited<ReturnType<typeof launchApp>>['window']) => ({
    ...(await page.evaluate(() => {
      const browserGlobal = globalThis as typeof globalThis & {
        document: {
          documentElement: {
            classList: {
              contains: (token: string) => boolean;
            };
            dataset: {
              colorThemeId?: string;
            };
          };
        };
      };

      return {
        isDark: browserGlobal.document.documentElement.classList.contains('dark'),
        themeId: browserGlobal.document.documentElement.dataset.colorThemeId ?? null,
      };
    })),
    stored: await readConfigValue(page, 'workbench.colorTheme'),
  });

  const firstLaunch = await launchApp();
  const { app: firstApp, window: firstWindow } = firstLaunch;

  await firstWindow.getByTestId('menu-settings-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toBeVisible();
  await openSettingsPage(firstWindow, 'appearance');

  await selectComboboxOption(
    firstWindow,
    'settings-theme-combobox',
    'settings-theme-option-vscode-2026-light',
  );
  await selectComboboxOption(
    firstWindow,
    'settings-theme-combobox',
    'settings-theme-option-vscode-2026-dark',
  );

  await expect.poll(async () => readThemeSnapshot(firstWindow)).toEqual({
    isDark: true,
    themeId: 'vscode-2026-dark',
    stored: 'vscode-2026-dark',
  });

  await firstWindow.getByTestId('settings-close-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toHaveCount(0);

  await firstApp.close();

  const secondLaunch = await launchApp();
  const { app: secondApp, window: secondWindow } = secondLaunch;

  await expect.poll(async () => readThemeSnapshot(secondWindow)).toEqual({
    isDark: true,
    themeId: 'vscode-2026-dark',
    stored: 'vscode-2026-dark',
  });

  await secondWindow.getByTestId('menu-settings-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toBeVisible();
  await openSettingsPage(secondWindow, 'appearance');

  await expect(secondWindow.getByTestId('settings-theme-combobox')).toContainText('Dark 2026');
  await selectComboboxOption(
    secondWindow,
    'settings-theme-combobox',
    'settings-theme-option-vscode-2026-light',
  );

  await expect.poll(async () => readThemeSnapshot(secondWindow)).toEqual({
    isDark: false,
    themeId: 'vscode-2026-light',
    stored: 'vscode-2026-light',
  });

  await secondWindow.getByTestId('settings-close-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toHaveCount(0);

  await secondApp.close();
});

test('global workbench chrome follows selected VS Code theme variables', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await expect(window.getByTestId('menu-bar-root')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');
  await expect(window.getByTestId('activity-bar')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');
  await expect(window.getByTestId('status-bar')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');
  await window.getByTestId('menu-settings-button').click();
  await expect(window.getByTestId('settings-dialog')).toBeVisible();

  await selectComboboxOption(
    window,
    'settings-code-viewer-layout-combobox',
    'settings-code-viewer-layout-option-compact',
  );
  await expect.poll(async () => readConfigValue(window, 'workbench.codeViewerLayoutMode')).toBe('compact');
  await expect(window.getByTestId('menu-bar-root')).toHaveAttribute('data-code-viewer-layout-mode', 'compact');
  await expect(window.getByTestId('activity-bar')).toHaveAttribute('data-code-viewer-layout-mode', 'compact');
  await expect(window.getByTestId('status-bar')).toHaveAttribute('data-code-viewer-layout-mode', 'compact');

  await openSettingsPage(window, 'appearance');
  await selectComboboxOption(
    window,
    'settings-theme-combobox',
    'settings-theme-option-vscode-2026-light',
  );

  await expect.poll(async () => readConfigValue(window, 'workbench.colorTheme')).toBe('vscode-2026-light');

  await window.getByTestId('settings-close-button').click();
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0);

  await expect.poll(async () => readWorkbenchChromeThemeSnapshot(window)).toEqual(
    expect.objectContaining({
      activity: expect.objectContaining({
        backgroundColor: expect.any(String),
      }),
      menu: expect.objectContaining({
        backgroundColor: expect.any(String),
      }),
      status: expect.objectContaining({
        backgroundColor: expect.any(String),
        color: expect.any(String),
      }),
    }),
  );

  const snapshot = await readWorkbenchChromeThemeSnapshot(window);

  expect(snapshot.menu.backgroundColor).toBe(snapshot.variables.menubarBackground);
  expect(snapshot.activity.backgroundColor).toBe(snapshot.variables.activitybarBackground);
  expect(snapshot.status.backgroundColor).toBe(snapshot.variables.statusbarBackground);
  expect(snapshot.status.color).toBe(snapshot.variables.statusbarForeground);
  expectSingleDevicePixelBorder(snapshot.menu.borderBottomWidth, snapshot.devicePixelRatio);
  expectSingleDevicePixelBorder(snapshot.activity.borderRightWidth, snapshot.devicePixelRatio);
  expectSingleDevicePixelBorder(snapshot.status.borderTopWidth, snapshot.devicePixelRatio);

  await app.close();
});

test('minimal layout unifies menu activity and status chrome', async () => {
  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await window.getByTestId('menu-settings-button').click();
  await expect(window.getByTestId('settings-dialog')).toBeVisible();

  await selectComboboxOption(
    window,
    'settings-code-viewer-layout-combobox',
    'settings-code-viewer-layout-option-minimal',
  );

  await expect.poll(async () => readConfigValue(window, 'workbench.codeViewerLayoutMode')).toBe('minimal');
  await expect(window.getByTestId('menu-bar-root')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');
  await expect(window.getByTestId('activity-bar')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');
  await expect(window.getByTestId('status-bar')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');

  await window.getByTestId('settings-close-button').click();
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0);

  const snapshot = await readWorkbenchChromeThemeSnapshot(window);

  expect(snapshot.menu.backgroundColor).toBe(snapshot.variables.unifiedChromeBackground);
  expect(snapshot.activity.backgroundColor).toBe(snapshot.variables.unifiedChromeBackground);
  expect(snapshot.status.backgroundColor).toBe(snapshot.variables.unifiedChromeBackground);
  expect(snapshot.status.color).toBe(snapshot.variables.unifiedChromeForeground);
  expect(snapshot.menu.borderBottomWidth).toBe('0px');
  expect(snapshot.activity.borderRightWidth).toBe('0px');
  expect(snapshot.status.borderTopWidth).toBe('0px');

  await app.close();
});

test('code viewer layout setting persists across app relaunch', async () => {
  test.slow();

  const firstLaunch = await launchApp();
  const { app: firstApp, window: firstWindow } = firstLaunch;

  await ensureExplorerVisible(firstWindow);
  await expect(firstWindow.getByTestId('code-view-explorer')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');
  await expectPanelHeaderWithoutDivider(firstWindow.getByTestId('left-panel-header'));
  await ensureRightPanelVisible(firstWindow);
  await expectPanelHeaderWithoutDivider(firstWindow.getByTestId('right-panel-header'));

  await firstWindow.getByTestId('menu-settings-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toBeVisible();
  await expect(firstWindow.getByTestId('settings-code-viewer-layout-combobox')).toContainText('Minimal');

  await selectComboboxOption(
    firstWindow,
    'settings-code-viewer-layout-combobox',
    'settings-code-viewer-layout-option-compact',
  );

  await expect.poll(async () => readConfigValue(firstWindow, 'workbench.codeViewerLayoutMode')).toBe('compact');
  await expect(firstWindow.getByTestId('settings-code-viewer-layout-combobox')).toContainText('Compact');
  await expect(firstWindow.getByTestId('code-view-explorer')).toHaveAttribute('data-code-viewer-layout-mode', 'compact');

  await firstWindow.getByTestId('settings-close-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toHaveCount(0);
  await expectPanelHeaderWithoutDivider(firstWindow.getByTestId('left-panel-header'));
  await ensureRightPanelVisible(firstWindow);
  await expectPanelHeaderWithoutDivider(firstWindow.getByTestId('right-panel-header'));

  await firstApp.close();

  const secondLaunch = await launchApp();
  const { app: secondApp, window: secondWindow } = secondLaunch;

  await ensureExplorerVisible(secondWindow);
  await expect(secondWindow.getByTestId('code-view-explorer')).toHaveAttribute('data-code-viewer-layout-mode', 'compact');
  await expect.poll(async () => readConfigValue(secondWindow, 'workbench.codeViewerLayoutMode')).toBe('compact');
  await expectPanelHeaderWithoutDivider(secondWindow.getByTestId('left-panel-header'));
  await ensureRightPanelVisible(secondWindow);
  await expectPanelHeaderWithoutDivider(secondWindow.getByTestId('right-panel-header'));

  await secondWindow.getByTestId('menu-settings-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toBeVisible();
  await expect(secondWindow.getByTestId('settings-code-viewer-layout-combobox')).toContainText('Compact');

  await selectComboboxOption(
    secondWindow,
    'settings-code-viewer-layout-combobox',
    'settings-code-viewer-layout-option-minimal',
  );
  await expect.poll(async () => readConfigValue(secondWindow, 'workbench.codeViewerLayoutMode')).toBe('minimal');
  await expect(secondWindow.getByTestId('code-view-explorer')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');

  await secondWindow.getByTestId('settings-close-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toHaveCount(0);
  await expectPanelHeaderWithoutDivider(secondWindow.getByTestId('left-panel-header'));
  await ensureRightPanelVisible(secondWindow);
  await expectPanelHeaderWithoutDivider(secondWindow.getByTestId('right-panel-header'));

  await secondApp.close();
});

test('minimal editor tabs keep their rounded height while the tab bar spacing stays tight', async () => {
  test.slow();

  const { app, window } = await launchApp();

  await ensureExplorerVisible(window);
  await window.getByTestId('menu-settings-button').click();
  await expect(window.getByTestId('settings-dialog')).toBeVisible();

  await selectComboboxOption(
    window,
    'settings-code-viewer-layout-combobox',
    'settings-code-viewer-layout-option-minimal',
  );

  await expect.poll(async () => readConfigValue(window, 'workbench.codeViewerLayoutMode')).toBe('minimal');
  await expect(window.getByTestId('code-view-explorer')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');

  await window.getByTestId('settings-close-button').click();
  await expect(window.getByTestId('settings-dialog')).toHaveCount(0);

  await openNestedWorkspaceFile(window, ['file-tree-node-README_md'], { finalAction: 'dblclick' });
  await openNestedWorkspaceFile(window, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_cpu_top_sv',
  ], { finalAction: 'dblclick' });

  const tabBar = window.getByTestId('editor-tab-bar');
  const readmeTab = window.getByTestId('editor-tab-README.md');
  const cpuTopTab = window.getByTestId('editor-tab-rtl/core/cpu_top.sv');

  await expect(readmeTab).toBeVisible();
  await expect(cpuTopTab).toBeVisible();
  await expect(tabBar).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');

  await expect.poll(async () => readEditorTabBarSpacingSnapshot(tabBar, readmeTab, cpuTopTab)).toEqual({
    columnGap: '0px',
    paddingBottom: '0px',
    paddingTop: '0px',
    heightDeltaPx: 3,
    horizontalGapPx: 0,
  });

  await expect.poll(async () => readEditorTabPaddingSnapshot(readmeTab)).toEqual({
    maxWidth: '180px',
    minWidth: '90px',
    paddingLeft: '8px',
    paddingRight: '8px',
  });

  await app.close();
});

async function readBundledThemeSnapshot(page: Awaited<ReturnType<typeof launchApp>>['window']) {
  return {
    ...(await page.evaluate(() => {
      const browserGlobal = globalThis as typeof globalThis & {
        document: {
          documentElement: {
            classList: {
              contains: (token: string) => boolean;
            };
            dataset: {
              colorThemeId?: string;
            };
          };
        };
      };

      return {
        isDark: browserGlobal.document.documentElement.classList.contains('dark'),
        themeId: browserGlobal.document.documentElement.dataset.colorThemeId ?? null,
      };
    })),
    stored: await readConfigValue(page, 'workbench.colorTheme'),
  };
}

async function expectBundledMonacoTheme(
  page: Awaited<ReturnType<typeof launchApp>>['window'],
  expectedColors: { background: string; lineNumber: string | string[] },
) {
  await expect.poll(async () => {
    const snapshot = await readMonacoAppearanceSnapshot(page, expectedColors);

    if (!snapshot) {
      return null;
    }

    if (
      snapshot.backgroundColor === snapshot.expectedBackgroundColor
      && snapshot.lineNumberColor !== null
      && snapshot.expectedLineNumberColors.includes(snapshot.lineNumberColor)
    ) {
      return null;
    }

    return {
      backgroundColor: snapshot.backgroundColor,
      expectedBackgroundColor: snapshot.expectedBackgroundColor,
      lineNumberColor: snapshot.lineNumberColor,
      expectedLineNumberColors: snapshot.expectedLineNumberColors,
    };
  }).toEqual(null);
}

async function expectBundledTerminalTheme(page: Awaited<ReturnType<typeof launchApp>>['window']) {
  await expect.poll(async () => {
    const themeState = await readTerminalThemeSnapshot(page);

    return {
      hasBackground: Boolean(themeState.terminalBackground),
      hasExpectedBackground: Boolean(themeState.expectedBackground),
      backgroundMatches: themeState.terminalBackground === themeState.expectedBackground,
    };
  }, {
    timeout: 15000,
  }).toEqual({
    hasBackground: true,
    hasExpectedBackground: true,
    backgroundMatches: true,
  });
}

async function openFileAndAssertBundledTheme(
  page: Awaited<ReturnType<typeof launchApp>>['window'],
  expectedMonacoColors: { background: string; lineNumber: string | string[] },
) {
  await ensureExplorerVisible(page);
  await openNestedWorkspaceFile(page, [
    'file-tree-node-rtl',
    'file-tree-node-rtl_core',
    'file-tree-node-rtl_core_reg_file_v',
  ]);
  await expect(page.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await waitForMonacoEditor(page);
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('module reg_file', {
    timeout: MONACO_READY_TIMEOUT_MS,
  });
  await focusMonacoEditor(page);
  await expectBundledMonacoTheme(page, expectedMonacoColors);

  await openBottomTerminal(page);
  await expect.poll(async () => readTerminalPid(page), {
    timeout: 15000,
  }).toBeGreaterThan(0);
  await expectBundledTerminalTheme(page);
}

async function assertBundledThemeSelectionPersistsAcrossRelaunch({
  searchText,
  themeId,
  themeLabel,
  isDark,
  expectedMonacoColors,
}: {
  searchText: string;
  themeId: string;
  themeLabel: string;
  isDark: boolean;
  expectedMonacoColors: { background: string; lineNumber: string | string[] };
}) {
  const firstLaunch = await launchApp();
  const { app: firstApp, window: firstWindow } = firstLaunch;

  await firstWindow.getByTestId('menu-settings-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toBeVisible();
  await openSettingsPage(firstWindow, 'appearance');
  await firstWindow.getByTestId('settings-theme-advanced-button').click();
  await expect(firstWindow.getByTestId('settings-theme-advanced-dialog')).toBeVisible();
  await firstWindow.getByTestId('settings-theme-advanced-search-input').fill(searchText);
  await firstWindow.getByTestId(`settings-theme-preview-card-${themeId}`).click();

  await expect.poll(async () => readBundledThemeSnapshot(firstWindow)).toEqual({
    isDark,
    themeId,
    stored: themeId,
  });

  await firstWindow.getByTestId('settings-close-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toHaveCount(0);

  await openFileAndAssertBundledTheme(firstWindow, expectedMonacoColors);

  await firstApp.close();

  const secondLaunch = await launchApp();
  const { app: secondApp, window: secondWindow } = secondLaunch;

  await expect.poll(async () => readBundledThemeSnapshot(secondWindow)).toEqual({
    isDark,
    themeId,
    stored: themeId,
  });

  await openFileAndAssertBundledTheme(secondWindow, expectedMonacoColors);

  await secondWindow.getByTestId('menu-settings-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toBeVisible();
  await openSettingsPage(secondWindow, 'appearance');
  await expect(secondWindow.getByTestId('settings-theme-combobox')).toContainText(themeLabel);
  await secondWindow.getByTestId('settings-close-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toHaveCount(0);

  await secondApp.close();
}

test('bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'pink',
    themeId: 'pink-cat-boo',
    themeLabel: 'Pink Cat Boo',
    isDark: true,
    expectedMonacoColors: {
      background: '#202330',
      lineNumber: ['#FFF0F5', '#BBBEBF'],
    },
  });
});

test('vendored upstream bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'one dark',
    themeId: 'one-dark-pro',
    themeLabel: 'One Dark Pro',
    isDark: true,
    expectedMonacoColors: {
      background: '#282c34',
      lineNumber: '#abb2bf',
    },
  });
});

test('second-batch vendored upstream light bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'github light default',
    themeId: 'github-light-default',
    themeLabel: 'GitHub Light Default',
    isDark: false,
    expectedMonacoColors: {
      background: '#ffffff',
      lineNumber: '#1f2328',
    },
  });
});

test('second-batch vendored upstream dark bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'tokyo night storm',
    themeId: 'tokyo-night-storm',
    themeLabel: 'Tokyo Night Storm',
    isDark: true,
    expectedMonacoColors: {
      background: '#24283b',
      lineNumber: '#8089b3',
    },
  });
});

test('third-batch vendored upstream light bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'solarized light',
    themeId: 'solarized-light',
    themeLabel: 'Solarized Light',
    isDark: false,
    expectedMonacoColors: {
      background: '#fdf6e3',
      lineNumber: '#6f7776',
    },
  });
});

test('third-batch vendored upstream dark bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'gruvbox dark medium',
    themeId: 'gruvbox-dark-medium',
    themeLabel: 'Gruvbox Dark Medium',
    isDark: true,
    expectedMonacoColors: {
      background: '#282828',
      lineNumber: '#BBBEBF',
    },
  });
});

test('fourth-batch vendored upstream dark bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'night owl',
    themeId: 'night-owl',
    themeLabel: 'Night Owl',
    isDark: true,
    expectedMonacoColors: {
      background: '#011627',
      lineNumber: ['#d6deeb', '#C5E4FD'],
    },
  });
});

test('fourth-batch vendored upstream light bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'noctis lux',
    themeId: 'noctis-lux',
    themeLabel: 'Noctis Lux',
    isDark: false,
    expectedMonacoColors: {
      background: '#fef8ec',
      lineNumber: ['#005661', '#0099ad'],
    },
  });
});

test('fifth-batch vendored upstream dark macOS Modern bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'ventura xcode default',
    themeId: 'macos-modern-dark-ventura-xcode-default',
    themeLabel: 'MacOS Modern Dark - Ventura Xcode Default',
    isDark: true,
    expectedMonacoColors: {
      background: '#232222',
      lineNumber: ['#747478', 'rgba(255, 255, 255, 0.85)'],
    },
  });
});

test('fifth-batch vendored upstream light macOS Modern bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'low key',
    themeId: 'macos-modern-light-ventura-xcode-low-key',
    themeLabel: 'MacOS Modern Light - Ventura Xcode Low Key',
    isDark: false,
    expectedMonacoColors: {
      background: '#ffffff',
      lineNumber: ['#bbbbbb', '#666666', '#000000'],
    },
  });
});

test('sixth-batch vendored upstream Dobri A-series bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'amethyst',
    themeId: 'dobri-next-a06-amethyst',
    themeLabel: 'Dobri Next -A06- Amethyst',
    isDark: true,
    expectedMonacoColors: {
      background: '#150022',
      lineNumber: ['#5C6370', '#BBBEBF', '#f5f5f5'],
    },
  });
});

test('sixth-batch vendored upstream Dobri C-series bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'cupcake',
    themeId: 'dobri-next-c03-cupcake',
    themeLabel: 'Dobri Next -C03- Cupcake',
    isDark: true,
    expectedMonacoColors: {
      background: '#0b1015',
      lineNumber: ['#858889', '#BBBEBF', '#f5f5f5'],
    },
  });
});

test('seventh-batch vendored upstream One Dark Pro dark bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'night flat',
    themeId: 'one-dark-pro-night-flat',
    themeLabel: 'One Dark Pro Night Flat',
    isDark: true,
    expectedMonacoColors: {
      background: '#16191d',
      lineNumber: ['#667187', '#abb2bf'],
    },
  });
});

test('seventh-batch vendored upstream GitHub light accessibility bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'light high contrast',
    themeId: 'github-light-high-contrast',
    themeLabel: 'GitHub Light High Contrast',
    isDark: false,
    expectedMonacoColors: {
      background: '#ffffff',
      lineNumber: ['#88929d', '#0e1116'],
    },
  });
});

test('eighth-batch official vendored upstream Copilot dark bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'copilot theme - higher contrast',
    themeId: 'copilot-theme-higher-contrast',
    themeLabel: 'Copilot Theme - Higher Contrast',
    isDark: true,
    expectedMonacoColors: {
      background: '#232a2f',
      lineNumber: ['#707a84', '#d4dce4', '#a8b2ba'],
    },
  });
});

test('eighth-batch official vendored upstream Visual Studio light bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'light (visual studio',
    themeId: 'visual-studio-light-cpp',
    themeLabel: 'Light (Visual Studio - C/C++)',
    isDark: false,
    expectedMonacoColors: {
      background: '#FFFFFF',
      lineNumber: ['#2b91af', '#000000'],
    },
  });
});

test('ninth-batch vendored upstream Palenight dark bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'palenight theme',
    themeId: 'palenight-theme',
    themeLabel: 'Palenight Theme',
    isDark: true,
    expectedMonacoColors: {
      background: '#292D3E',
      lineNumber: ['#4c5374', '#eeffff', '#bfc7d5'],
    },
  });
});

test('ninth-batch vendored upstream Light Owl bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'light owl',
    themeId: 'light-owl',
    themeLabel: 'Light Owl',
    isDark: false,
    expectedMonacoColors: {
      background: '#FBFBFB',
      lineNumber: ['#90A7B2', '#403F53'],
    },
  });
});

test('tenth-batch vendored upstream Andromeda dark bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'andromeda',
    themeId: 'andromeda',
    themeLabel: 'Andromeda',
    isDark: true,
    expectedMonacoColors: {
      background: '#23262E',
      lineNumber: ['#746f77', '#BBBEBF', '#D5CED9'],
    },
  });
});

test('tenth-batch vendored upstream Atom One Light bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'atom one light',
    themeId: 'atom-one-light',
    themeLabel: 'Atom One Light',
    isDark: false,
    expectedMonacoColors: {
      background: '#FAFAFA',
      lineNumber: ['#9D9D9F', '#383A42'],
    },
  });
});

test('eleventh-batch vendored upstream Slack Aubergine Dark bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'slack theme aubergine dark',
    themeId: 'slack-aubergine-dark-editor',
    themeLabel: 'Slack Theme Aubergine Dark',
    isDark: true,
    expectedMonacoColors: {
      background: '#3E313C',
      lineNumber: ['#B9B9B9', '#BBBEBF', '#F6F6F4'],
    },
  });
});

test('eleventh-batch vendored upstream Github Light Theme - Gray bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'github light theme - gray',
    themeId: 'github-light-theme-gray',
    themeLabel: 'Github Light Theme - Gray',
    isDark: false,
    expectedMonacoColors: {
      background: '#F0F0F0',
      lineNumber: ['#BABBBC', '#000000'],
    },
  });
});

test('eleventh-batch vendored upstream Mayukai Midnight bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'mayukai midnight',
    themeId: 'mayukai-midnight',
    themeLabel: 'Mayukai Midnight',
    isDark: true,
    expectedMonacoColors: {
      background: '#141824',
      lineNumber: ['#707A8C66', '#707A8CCC', '#CBCCC6'],
    },
  });
});

test('final-batch vendored upstream Winter is Coming (Dark) bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'winter is coming',
    themeId: 'winter-is-coming-dark',
    themeLabel: 'Winter is Coming (Dark)',
    isDark: true,
    expectedMonacoColors: {
      background: '#282822',
      lineNumber: ['#219FD5', '#A7DBF7', '#BBBEBF', '#D6DEEB'],
    },
  });
});

test('final-batch vendored upstream Alabaster bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'alabaster',
    themeId: 'alabaster',
    themeLabel: 'Alabaster',
    isDark: false,
    expectedMonacoColors: {
      background: '#F7F7F7',
      lineNumber: ['#9DA39A', '#000000', '#202020', '#434343'],
    },
  });
});

test('final-batch vendored upstream Electron bundled UI theme selection persists across app relaunch and updates Monaco and terminal styling', async () => {
  test.slow();

  await assertBundledThemeSelectionPersistsAcrossRelaunch({
    searchText: 'electron',
    themeId: 'electron',
    themeLabel: 'Electron',
    isDark: true,
    expectedMonacoColors: {
      background: '#212836',
      lineNumber: ['#3D4D67', '#818CA6', '#97A7C8'],
    },
  });
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
  await waitForMonacoEditor(firstWindow);
  await expect(firstWindow.locator('.monaco-editor .view-lines')).toContainText('module reg_file', {
    timeout: MONACO_READY_TIMEOUT_MS,
  });

  await firstWindow.getByTestId('menu-settings-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toBeVisible();
  await openSettingsPage(firstWindow, 'editor');

  await selectComboboxOption(
    firstWindow,
    'settings-editor-font-family-combobox',
    'settings-editor-font-family-option-monaspace-neon',
  );
  await selectComboboxOption(
    firstWindow,
    'settings-editor-word-wrap-combobox',
    'settings-editor-word-wrap-option-on',
  );
  await selectComboboxOption(
    firstWindow,
    'settings-editor-tab-size-combobox',
    'settings-editor-tab-size-option-2',
  );
  await selectComboboxOption(
    firstWindow,
    'settings-editor-cursor-blinking-combobox',
    'settings-editor-cursor-blinking-option-solid',
  );
  await selectComboboxOption(
    firstWindow,
    'settings-editor-render-whitespace-combobox',
    'settings-editor-render-whitespace-option-all',
  );
  await selectComboboxOption(
    firstWindow,
    'settings-editor-line-numbers-combobox',
    'settings-editor-line-numbers-option-relative',
  );
  await selectComboboxOption(
    firstWindow,
    'settings-editor-folding-strategy-combobox',
    'settings-editor-folding-strategy-option-auto',
  );
  await setEditorFontSizePreset(firstWindow, 'max');
  await firstWindow.getByTestId('settings-editor-font-ligatures-switch').scrollIntoViewIfNeeded();
  await setSwitchChecked(firstWindow.getByTestId('settings-editor-font-ligatures-switch'), false);
  await setSwitchChecked(firstWindow.getByTestId('settings-editor-render-control-characters-switch'), true);
  await setSwitchChecked(firstWindow.getByTestId('settings-editor-smooth-scrolling-switch'), false);
  await setSwitchChecked(firstWindow.getByTestId('settings-editor-scroll-beyond-last-line-switch'), true);
  await setSwitchChecked(firstWindow.getByTestId('settings-editor-minimap-switch'), false);
  await setSwitchChecked(firstWindow.getByTestId('settings-editor-glyph-margin-switch'), false);
  await setSwitchChecked(firstWindow.getByTestId('settings-editor-bracket-pair-guides-switch'), false);
  await setSwitchChecked(firstWindow.getByTestId('settings-editor-indent-guides-switch'), false);

  await expect.poll(async () => readConfigValue(firstWindow, 'editor.fontFamily')).toBe('monaspace-neon');
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.fontSize')).toBe(24);
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.fontLigatures')).toBe(false);
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.wordWrap')).toBe('on');
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.tabSize')).toBe(2);
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.renderWhitespace')).toBe('all');
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.renderControlCharacters')).toBe(true);
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.cursorBlinking')).toBe('solid');
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.lineNumbers')).toBe('relative');
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.smoothScrolling')).toBe(false);
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.scrollBeyondLastLine')).toBe(true);
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.foldingStrategy')).toBe('auto');
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.minimap.enabled')).toBe(false);
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.glyphMargin')).toBe(false);
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.guides.bracketPairs')).toBe(false);
  await expect.poll(async () => readConfigValue(firstWindow, 'editor.guides.indentation')).toBe(false);
  await expect(firstWindow.getByTestId('settings-editor-font-family-combobox')).toContainText('Monaspace Neon');
  await expect(firstWindow.getByTestId('settings-editor-font-size-value')).toHaveText('24px');
  await expect(firstWindow.getByTestId('settings-editor-word-wrap-combobox')).toContainText('On');
  await expect(firstWindow.getByTestId('settings-editor-tab-size-combobox')).toContainText('2 spaces');
  await expect(firstWindow.getByTestId('settings-editor-cursor-blinking-combobox')).toContainText('Solid');
  await expect(firstWindow.getByTestId('settings-editor-render-whitespace-combobox')).toContainText('All');
  await expect(firstWindow.getByTestId('settings-editor-line-numbers-combobox')).toContainText('Relative');
  await expect(firstWindow.getByTestId('settings-editor-folding-strategy-combobox')).toContainText('Auto');
  await expect(firstWindow.getByTestId('settings-editor-font-ligatures-switch')).toHaveAttribute('data-state', 'unchecked');
  await expect(firstWindow.getByTestId('settings-editor-render-control-characters-switch')).toHaveAttribute('data-state', 'checked');
  await expect(firstWindow.getByTestId('settings-editor-smooth-scrolling-switch')).toHaveAttribute('data-state', 'unchecked');
  await expect(firstWindow.getByTestId('settings-editor-scroll-beyond-last-line-switch')).toHaveAttribute('data-state', 'checked');
  await expect(firstWindow.getByTestId('settings-editor-minimap-switch')).toHaveAttribute('data-state', 'unchecked');
  await expect(firstWindow.getByTestId('settings-editor-glyph-margin-switch')).toHaveAttribute('data-state', 'unchecked');
  await expect(firstWindow.getByTestId('settings-editor-bracket-pair-guides-switch')).toHaveAttribute('data-state', 'unchecked');
  await expect(firstWindow.getByTestId('settings-editor-indent-guides-switch')).toHaveAttribute('data-state', 'unchecked');

  await firstWindow.getByTestId('settings-close-button').click();
  await expect(firstWindow.getByTestId('settings-dialog')).toHaveCount(0);

  await expect
    .poll(async () => {
      const snapshot = await readMonacoAppearanceSnapshot(firstWindow);

      return snapshot
        ? {
            fontFamilyIncludesSelection: snapshot.fontFamily.includes('Monaspace Neon'),
            fontSize: snapshot.fontSize,
          }
        : null;
    })
    .toEqual({
      fontFamilyIncludesSelection: true,
      fontSize: '24px',
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
  await waitForMonacoEditor(secondWindow);
  await expect(secondWindow.locator('.monaco-editor .view-lines')).toContainText('module reg_file', {
    timeout: MONACO_READY_TIMEOUT_MS,
  });

  await expect
    .poll(async () => {
      const snapshot = await readMonacoAppearanceSnapshot(secondWindow);

      return snapshot
        ? {
            fontFamilyIncludesSelection: snapshot.fontFamily.includes('Monaspace Neon'),
            fontSize: snapshot.fontSize,
          }
        : null;
    })
    .toEqual({
      fontFamilyIncludesSelection: true,
      fontSize: '24px',
    });

  await secondWindow.getByTestId('menu-settings-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toBeVisible();
  await openSettingsPage(secondWindow, 'editor');
  await expect(secondWindow.getByTestId('settings-editor-font-family-combobox')).toContainText('Monaspace Neon');
  await expect(secondWindow.getByTestId('settings-editor-font-size-value')).toHaveText('24px');
  await expect(secondWindow.getByTestId('settings-editor-word-wrap-combobox')).toContainText('On');
  await expect(secondWindow.getByTestId('settings-editor-tab-size-combobox')).toContainText('2 spaces');
  await expect(secondWindow.getByTestId('settings-editor-cursor-blinking-combobox')).toContainText('Solid');
  await expect(secondWindow.getByTestId('settings-editor-render-whitespace-combobox')).toContainText('All');
  await expect(secondWindow.getByTestId('settings-editor-line-numbers-combobox')).toContainText('Relative');
  await expect(secondWindow.getByTestId('settings-editor-folding-strategy-combobox')).toContainText('Auto');
  await expect(secondWindow.getByTestId('settings-editor-font-ligatures-switch')).toHaveAttribute('data-state', 'unchecked');
  await expect(secondWindow.getByTestId('settings-editor-render-control-characters-switch')).toHaveAttribute('data-state', 'checked');
  await expect(secondWindow.getByTestId('settings-editor-smooth-scrolling-switch')).toHaveAttribute('data-state', 'unchecked');
  await expect(secondWindow.getByTestId('settings-editor-scroll-beyond-last-line-switch')).toHaveAttribute('data-state', 'checked');
  await expect(secondWindow.getByTestId('settings-editor-minimap-switch')).toHaveAttribute('data-state', 'unchecked');
  await expect(secondWindow.getByTestId('settings-editor-glyph-margin-switch')).toHaveAttribute('data-state', 'unchecked');
  await expect(secondWindow.getByTestId('settings-editor-bracket-pair-guides-switch')).toHaveAttribute('data-state', 'unchecked');
  await expect(secondWindow.getByTestId('settings-editor-indent-guides-switch')).toHaveAttribute('data-state', 'unchecked');

  await selectComboboxOption(
    secondWindow,
    'settings-editor-font-family-combobox',
    'settings-editor-font-family-option-jetbrains-mono',
  );
  await setEditorFontSizePreset(secondWindow, 'min');
  await selectComboboxOption(
    secondWindow,
    'settings-editor-word-wrap-combobox',
    'settings-editor-word-wrap-option-off',
  );
  await selectComboboxOption(
    secondWindow,
    'settings-editor-tab-size-combobox',
    'settings-editor-tab-size-option-4',
  );
  await selectComboboxOption(
    secondWindow,
    'settings-editor-cursor-blinking-combobox',
    'settings-editor-cursor-blinking-option-smooth',
  );
  await selectComboboxOption(
    secondWindow,
    'settings-editor-render-whitespace-combobox',
    'settings-editor-render-whitespace-option-selection',
  );
  await selectComboboxOption(
    secondWindow,
    'settings-editor-line-numbers-combobox',
    'settings-editor-line-numbers-option-on',
  );
  await selectComboboxOption(
    secondWindow,
    'settings-editor-folding-strategy-combobox',
    'settings-editor-folding-strategy-option-indentation',
  );
  await secondWindow.getByTestId('settings-editor-font-ligatures-switch').scrollIntoViewIfNeeded();
  await setSwitchChecked(secondWindow.getByTestId('settings-editor-font-ligatures-switch'), true);
  await setSwitchChecked(secondWindow.getByTestId('settings-editor-render-control-characters-switch'), false);
  await setSwitchChecked(secondWindow.getByTestId('settings-editor-smooth-scrolling-switch'), true);
  await setSwitchChecked(secondWindow.getByTestId('settings-editor-scroll-beyond-last-line-switch'), false);
  await setSwitchChecked(secondWindow.getByTestId('settings-editor-minimap-switch'), true);
  await setSwitchChecked(secondWindow.getByTestId('settings-editor-glyph-margin-switch'), true);
  await setSwitchChecked(secondWindow.getByTestId('settings-editor-bracket-pair-guides-switch'), true);
  await setSwitchChecked(secondWindow.getByTestId('settings-editor-indent-guides-switch'), true);

  await expect.poll(async () => readConfigValue(secondWindow, 'editor.fontFamily')).toBe('jetbrains-mono');
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.fontSize')).toBe(10);
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.fontLigatures')).toBe(true);
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.wordWrap')).toBe('off');
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.tabSize')).toBe(4);
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.renderWhitespace')).toBe('selection');
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.renderControlCharacters')).toBe(false);
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.cursorBlinking')).toBe('smooth');
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.lineNumbers')).toBe('on');
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.smoothScrolling')).toBe(true);
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.scrollBeyondLastLine')).toBe(false);
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.foldingStrategy')).toBe('indentation');
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.minimap.enabled')).toBe(true);
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.glyphMargin')).toBe(true);
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.guides.bracketPairs')).toBe(true);
  await expect.poll(async () => readConfigValue(secondWindow, 'editor.guides.indentation')).toBe(true);

  await secondWindow.getByTestId('settings-close-button').click();
  await expect(secondWindow.getByTestId('settings-dialog')).toHaveCount(0);

  await expect
    .poll(async () => {
      const snapshot = await readMonacoAppearanceSnapshot(secondWindow);

      return snapshot
        ? {
            fontFamilyIncludesSelection: snapshot.fontFamily.includes('JetBrains Mono'),
            fontSize: snapshot.fontSize,
          }
        : null;
    })
    .toEqual({
      fontFamilyIncludesSelection: true,
      fontSize: '10px',
    });

  await secondApp.close();
});

test('editor font combobox supports wheel scrolling and UI theme combobox reopens at the selected option', async () => {
  const { app, window } = await launchApp()

  await window.getByTestId('menu-settings-button').click()
  await expect(window.getByTestId('settings-dialog')).toBeVisible()
  await openSettingsPage(window, 'editor')

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
  await expect(window.getByTestId('settings-editor-font-family-option-victor-mono')).toBeVisible()
  await expect.poll(async () => {
    const snapshot = await readComboboxListSnapshot(
      window,
      'settings-editor-font-family-combobox-list',
      'settings-editor-font-family-option-victor-mono',
    )

    return snapshot?.scrollTop ?? 0
  }).toBeGreaterThan(0)
  await window.keyboard.press('Escape')

  await openSettingsPage(window, 'appearance')
  await selectComboboxOption(
    window,
    'settings-theme-combobox',
    'settings-theme-option-vscode-2026-light',
  )
  await expect(window.getByTestId('settings-theme-combobox')).toContainText('Light 2026')

  await window.getByTestId('settings-theme-combobox').click()
  const themeList = window.locator('[data-combobox-list="settings-theme-combobox-list"]')
  await expect(themeList).toBeVisible()
  await expect(window.getByTestId('settings-theme-option-vscode-2026-light')).toBeVisible()
  await expect
    .poll(async () => {
      const snapshot = await readComboboxListSnapshot(
        window,
        'settings-theme-combobox-list',
        'settings-theme-option-vscode-2026-light',
      )

      return snapshot?.selectedFullyVisible ?? false
    })
    .toBe(true)

  await window.keyboard.press('Escape')
  await app.close()
})

test('settings comboboxes show hover previews for theme and font options', async () => {
  const { app, window } = await launchApp()

  await window.getByTestId('menu-settings-button').click()
  await expect(window.getByTestId('settings-dialog')).toBeVisible()
  await openSettingsPage(window, 'appearance')

  const themeCombobox = window.getByTestId('settings-theme-combobox')

  await themeCombobox.click()

  const themePopoverSurface = window.getByTestId('settings-theme-combobox-popover-surface')
  const themePreviewPane = window.getByTestId('settings-theme-combobox-preview-pane')
  const themeSearchInput = window.getByPlaceholder('Search UI themes...')
  const expectedSearchTextColor = await readNormalizedCssColorVariable(window, '--ide-text')

  await expect(themePopoverSurface).toBeVisible()
  await expect(themePreviewPane).toHaveAttribute('data-state', 'hidden')
  await expect(themeSearchInput).toHaveClass(/pristine-command-search-input/)

  const themeSearchInputColors = await readSearchInputVisualState(themeSearchInput)
  expect(themeSearchInputColors.color).toBe(expectedSearchTextColor)
  expect(themeSearchInputColors.color).not.toBe('rgb(0, 0, 0)')
  expect(themeSearchInputColors.color).not.toBe('rgba(0, 0, 0, 0)')
  expect(themeSearchInputColors.caretColor).toBe(themeSearchInputColors.color)
  expect(themeSearchInputColors.webkitTextFillColor).toBe(themeSearchInputColors.color)

  await expect
    .poll(async () => {
      const [comboboxBox, popoverBox] = await Promise.all([
        themeCombobox.boundingBox(),
        themePopoverSurface.boundingBox(),
      ])

      if (!comboboxBox || !popoverBox) {
        return false
      }

      return Math.abs(Math.round(popoverBox.width) - Math.round(comboboxBox.width)) <= 1
    })
    .toBe(true)

  const themeOption = window.getByTestId('settings-theme-option-vscode-2026-light')

  await themeOption.hover()

  await expect(themePreviewPane).toHaveAttribute('data-state', 'visible')
  await expect(themePreviewPane).toHaveAttribute('data-side', /^(left|right)$/)
  await expect(window.getByTestId('settings-theme-combobox-preview-card-vscode-2026-light')).toBeVisible()
  await expect(window.getByTestId('settings-theme-combobox-preview-line-module-vscode-2026-light')).toContainText('module alu(clk)')
  await expect
    .poll(async () => {
      const [themeOptionBox, themePreviewBox] = await Promise.all([
        themeOption.boundingBox(),
        themePreviewPane.boundingBox(),
      ])

      if (!themeOptionBox || !themePreviewBox) {
        return false
      }

      const isRight = themePreviewBox.x >= themeOptionBox.x + themeOptionBox.width
      const isLeft = themePreviewBox.x + themePreviewBox.width <= themeOptionBox.x

      return (isRight || isLeft)
        && themePreviewBox.y <= themeOptionBox.y + themeOptionBox.height
        && themePreviewBox.y + themePreviewBox.height >= themeOptionBox.y
    })
    .toBe(true)

  await window.mouse.move(1, 1)
  await expect(themePreviewPane).toHaveAttribute('data-state', 'hidden')
  await window.keyboard.press('Escape')

  await openSettingsPage(window, 'editor')
  const fontCombobox = window.getByTestId('settings-editor-font-family-combobox')

  await fontCombobox.click()

  const fontPopoverSurface = window.getByTestId('settings-editor-font-family-combobox-popover-surface')
  const fontPreviewPane = window.getByTestId('settings-editor-font-family-combobox-preview-pane')

  await expect(fontPopoverSurface).toBeVisible()
  await expect(fontPreviewPane).toHaveAttribute('data-state', 'hidden')

  await expect
    .poll(async () => {
      const [comboboxBox, popoverBox] = await Promise.all([
        fontCombobox.boundingBox(),
        fontPopoverSurface.boundingBox(),
      ])

      if (!comboboxBox || !popoverBox) {
        return false
      }

      return Math.abs(Math.round(popoverBox.width) - Math.round(comboboxBox.width)) <= 1
    })
    .toBe(true)

  const fontOption = window.getByTestId('settings-editor-font-family-option-victor-mono')

  await fontOption.hover()

  await expect(fontPreviewPane).toHaveAttribute('data-state', 'visible')
  await expect(fontPreviewPane).toHaveAttribute('data-side', /^(left|right)$/)
  await expect(window.getByTestId('settings-editor-font-family-combobox-preview-card-victor-mono')).toBeVisible()
  await expect(window.getByTestId('settings-editor-font-family-combobox-preview-author-victor-mono')).toContainText('Rubjo Vampjoen')
  await expect
    .poll(async () => {
      const [fontOptionBox, fontPreviewBox] = await Promise.all([
        fontOption.boundingBox(),
        fontPreviewPane.boundingBox(),
      ])

      if (!fontOptionBox || !fontPreviewBox) {
        return false
      }

      const isRight = fontPreviewBox.x >= fontOptionBox.x + fontOptionBox.width
      const isLeft = fontPreviewBox.x + fontPreviewBox.width <= fontOptionBox.x

      return (isRight || isLeft)
        && fontPreviewBox.y <= fontOptionBox.y + fontOptionBox.height
        && fontPreviewBox.y + fontPreviewBox.height >= fontOptionBox.y
    })
    .toBe(true)

  await window.mouse.move(1, 1)
  await expect(fontPreviewPane).toHaveAttribute('data-state', 'hidden')
  await window.keyboard.press('Escape')

  await app.close()
})

test('settings UI theme combobox keeps a stable width when selecting a long theme name', async () => {
  const { app, window } = await launchApp()

  await window.getByTestId('menu-settings-button').click()
  await expect(window.getByTestId('settings-dialog')).toBeVisible()
  await openSettingsPage(window, 'appearance')

  const themeCombobox = window.getByTestId('settings-theme-combobox')
  const initialBox = await themeCombobox.boundingBox()

  if (!initialBox) {
    throw new Error('Expected settings theme combobox to have a bounding box before selection')
  }

  await selectComboboxOption(
    window,
    'settings-theme-combobox',
    'settings-theme-option-macos-modern-light-ventura-xcode-low-key',
  )

  await expect(themeCombobox).toContainText('MacOS Modern Light - Ventura Xcode Low Key')
  await expect
    .poll(async () => {
      const box = await themeCombobox.boundingBox()

      return box ? Math.round(box.width) : null
    })
    .toBe(Math.round(initialBox.width))

  await app.close()
})

test('advanced editor font picker closes after selecting a preview card and syncs the font setting', async () => {
  const { app, window } = await launchApp()

  await window.getByTestId('menu-settings-button').click()
  await expect(window.getByTestId('settings-dialog')).toBeVisible()
  await openSettingsPage(window, 'editor')

  const advancedDialog = window.locator('[data-testid="settings-editor-font-family-advanced-dialog"]')
  await window.getByTestId('settings-editor-font-family-advanced-button').click()
  await expect(advancedDialog).toBeVisible()

  await expect(window.getByTestId('settings-editor-font-family-preview-letters-victor-mono')).toContainText('AaBbCcDdEe')
  await expect(window.getByTestId('settings-editor-font-family-preview-digits-victor-mono')).toContainText('0123456789')

  await window.getByTestId('settings-editor-font-family-preview-card-victor-mono').click()

  await expect(advancedDialog).toHaveCount(0)
  await expect(window.getByTestId('settings-editor-font-family-combobox')).toContainText('Victor Mono')
  await expect.poll(async () => readConfigValue(window, 'editor.fontFamily')).toBe('victor-mono')

  await app.close()
})

test('advanced UI theme picker closes after selecting a preview card and syncs the theme setting', async () => {
  const { app, window } = await launchApp()

  await window.getByTestId('menu-settings-button').click()
  await expect(window.getByTestId('settings-dialog')).toBeVisible()
  await openSettingsPage(window, 'appearance')

  const advancedDialog = window.locator('[data-testid="settings-theme-advanced-dialog"]')
  await window.getByTestId('settings-theme-advanced-button').click()
  await expect(advancedDialog).toBeVisible()

  const darkCard = window.getByTestId('settings-theme-preview-card-vscode-2026-dark')
  const lightCard = window.getByTestId('settings-theme-preview-card-vscode-2026-light')

  await expect(darkCard).toHaveAttribute('data-state', 'selected')
  await expect(darkCard).toContainText('Dark 2026')
  await expect(window.getByTestId('settings-theme-preview-editor-vscode-2026-light')).toBeVisible()
  await expect(lightCard).toContainText('Microsoft')
  await expect(window.getByTestId('settings-theme-preview-line-module-vscode-2026-light')).toContainText('module alu(clk)')
  await expect(window.getByTestId('settings-theme-preview-selection-vscode-2026-light')).toContainText("sum = calc('RUN')")

  await lightCard.click()

  await expect(advancedDialog).toHaveCount(0)
  await expect(window.getByTestId('settings-theme-combobox')).toContainText('Light 2026')
  await expect.poll(async () => readConfigValue(window, 'workbench.colorTheme')).toBe('vscode-2026-light')

  await app.close()
})

test('advanced UI theme picker layout toggle persists across app relaunch', async () => {
  const firstLaunch = await launchApp()
  const { app: firstApp, window: firstWindow } = firstLaunch

  await firstWindow.getByTestId('menu-settings-button').click()
  await expect(firstWindow.getByTestId('settings-dialog')).toBeVisible()
  await openSettingsPage(firstWindow, 'appearance')

  await firstWindow.getByTestId('settings-theme-advanced-button').click()
  await expect(firstWindow.getByTestId('settings-theme-advanced-dialog')).toBeVisible()
  await expect(firstWindow.getByTestId('settings-theme-advanced-layout-list-button')).toHaveAttribute('aria-label', 'List layout')
  await expect(firstWindow.getByTestId('settings-theme-advanced-layout-grouped-button')).toHaveAttribute('aria-label', 'Grouped layout')
  await expect(firstWindow.getByTestId('settings-theme-advanced-layout-list-button')).toHaveAttribute('data-state', 'on')
  await expect(firstWindow.locator('[data-testid="settings-theme-advanced-dark-section"]')).toHaveCount(0)
  await expect(firstWindow.locator('[data-testid="settings-theme-advanced-light-section"]')).toHaveCount(0)

  await firstWindow.getByTestId('settings-theme-advanced-layout-grouped-button').click()

  await expect(firstWindow.getByTestId('settings-theme-advanced-layout-grouped-button')).toHaveAttribute('data-state', 'on')
  await expect(firstWindow.getByTestId('settings-theme-advanced-dark-section')).toBeVisible()
  await expect(firstWindow.getByTestId('settings-theme-advanced-light-section')).toBeVisible()
  await expect.poll(async () => readConfigValue(firstWindow, 'workbench.themePickerLayoutMode')).toBe('grouped')

  await firstApp.close()

  const secondLaunch = await launchApp()
  const { app: secondApp, window: secondWindow } = secondLaunch

  await secondWindow.getByTestId('menu-settings-button').click()
  await expect(secondWindow.getByTestId('settings-dialog')).toBeVisible()
  await openSettingsPage(secondWindow, 'appearance')

  await secondWindow.getByTestId('settings-theme-advanced-button').click()
  await expect(secondWindow.getByTestId('settings-theme-advanced-dialog')).toBeVisible()
  await expect(secondWindow.getByTestId('settings-theme-advanced-layout-grouped-button')).toHaveAttribute('data-state', 'on')
  await expect(secondWindow.getByTestId('settings-theme-advanced-dark-section')).toBeVisible()
  await expect(secondWindow.getByTestId('settings-theme-advanced-light-section')).toBeVisible()

  await secondWindow.getByTestId('settings-theme-advanced-layout-list-button').click()

  await expect(secondWindow.getByTestId('settings-theme-advanced-layout-list-button')).toHaveAttribute('data-state', 'on')
  await expect(secondWindow.locator('[data-testid="settings-theme-advanced-dark-section"]')).toHaveCount(0)
  await expect(secondWindow.locator('[data-testid="settings-theme-advanced-light-section"]')).toHaveCount(0)
  await expect.poll(async () => readConfigValue(secondWindow, 'workbench.themePickerLayoutMode')).toBe('list')

  await secondApp.close()
})

test('newly downloaded Monaco font options can be selected and persist to config', async () => {
  const { app, window } = await launchApp()

  await window.getByTestId('menu-settings-button').click()
  await expect(window.getByTestId('settings-dialog')).toBeVisible()
  await openSettingsPage(window, 'editor')

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
    stored: await readConfigValue(page, 'workbench.colorTheme'),
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
  await openSettingsPage(window, 'window');

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
  await openSettingsPage(window, 'window');
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
