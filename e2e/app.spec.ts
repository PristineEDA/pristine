import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureWorkspace = path.join(__dirname, '..', 'test', 'fixtures', 'workspace');

test.skip(process.platform === 'darwin', 'Custom window controls are hidden on macOS');

async function launchApp() {
  const app = await electron.launch({
    args: [path.join(__dirname, '..', 'dist-electron', 'main.js')],
    env: {
      ...process.env,
      PRISTINE_E2E: '1',
      PRISTINE_PROJECT_ROOT: fixtureWorkspace,
    },
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  return { app, window };
}

async function openNestedWorkspaceFile(window: Awaited<ReturnType<typeof launchApp>>['window'], pathTestIds: string[]) {
  for (const testId of pathTestIds) {
    const node = window.getByTestId(testId);
    await expect(node).toBeVisible();
    await node.click();
  }
}

async function openBottomTerminal(window: Awaited<ReturnType<typeof launchApp>>['window']) {
  const toggleBottomPanel = window.getByTestId('toggle-bottom-panel');
  await expect(toggleBottomPanel).toBeVisible();

  if ((await toggleBottomPanel.getAttribute('aria-pressed')) !== 'true') {
    await toggleBottomPanel.click();
  }

  const terminalHost = window.getByTestId('terminal-host');
  await expect(terminalHost).toBeVisible();
  await expect(window.locator('[data-testid="terminal-host"] .xterm')).toBeVisible();

  return terminalHost;
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
    probe.style.backgroundColor = 'var(--ide-dracula-background)';
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

test('close button closes the main window', async () => {
  const { app, window } = await launchApp();

  const closePromise = window.waitForEvent('close');
  await window.getByTestId('window-control-close').click();
  await closePromise;

  await expect.poll(() => app.windows().length).toBe(0);
});

test('explorer opens a file into a new editor tab', async () => {
  const { app, window } = await launchApp();

  const fileNode = window.getByTestId('file-tree-node-README_md');
  await expect(fileNode).toBeVisible();
  await fileNode.click();

  await expect(window.getByTestId('editor-tab-README.md')).toBeVisible();
  await expect(window.locator('.monaco-editor .view-lines')).toContainText('Fixture Workspace');

  await app.close();
});

test('single-clicked explorer files stay in preview style until double-clicked to pin', async () => {
  const { app, window } = await launchApp();

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

test('ctrl+p quick open searches files, navigates results, and reveals the selected file', async () => {
  const { app, window } = await launchApp();

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

  const explorerButton = window.getByTestId('activity-item-explorer');
  await explorerButton.click();
  await expect(window.getByTestId('file-tree-node-README_md')).toHaveCount(0);

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

test('explorer root supports toggle and collapse all behaviors', async () => {
  const { app, window } = await launchApp();

  const collapseAllButton = window.getByTitle('Collapse All');
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

test('activity bar removes search and extensions and toggles the left sidebar', async () => {
  const { app, window } = await launchApp();

  await expect(window.getByTestId('activity-item-explorer')).toBeVisible();
  await expect(window.getByTestId('activity-item-debug')).toBeVisible();
  await expect(window.getByTestId('activity-item-git')).toHaveCount(0);
  await expect(window.getByTestId('activity-item-search')).toHaveCount(0);
  await expect(window.getByTestId('activity-item-extensions')).toHaveCount(0);

  const explorerFileNode = window.getByTestId('file-tree-node-README_md');
  await expect(explorerFileNode).toBeVisible();

  const explorerButton = window.getByTestId('activity-item-explorer');
  await explorerButton.click();
  await expect(explorerFileNode).toHaveCount(0);
  await expect(explorerButton).toHaveClass(/border-transparent/);
  await expect(explorerButton).not.toHaveClass(/border-ide-accent/);

  const debugButton = window.getByTestId('activity-item-debug');
  await debugButton.click();
  await expect(explorerFileNode).toBeVisible();
  await expect(debugButton).toHaveClass(/border-ide-accent/);

  await debugButton.click();
  await expect(explorerFileNode).toHaveCount(0);
  await expect(debugButton).toHaveClass(/border-transparent/);
  await expect(debugButton).not.toHaveClass(/border-ide-accent/);

  await app.close();
});

test('left sidebar width is resized to keep tab labels readable when the window size changes', async () => {
  const { app, window } = await launchApp();
  const browserWindow = await app.browserWindow(window);
  const leftPanel = window.locator('#left-panel');

  await browserWindow.evaluate((win) => win.setSize(1600, 900));

  await expect.poll(async () => {
    const box = await leftPanel.boundingBox();
    return Math.round(box?.width ?? 0);
  }).toBeGreaterThan(220);
  await expect.poll(async () => {
    const box = await leftPanel.boundingBox();
    return Math.round(box?.width ?? 0);
  }).toBeLessThan(260);

  const wideWidth = Math.round((await leftPanel.boundingBox())?.width ?? 0);

  await browserWindow.evaluate((win) => win.setSize(1100, 900));

  await expect.poll(async () => {
    const box = await leftPanel.boundingBox();
    return Math.round(box?.width ?? 0);
  }).toBeGreaterThan(220);
  await expect.poll(async () => {
    const box = await leftPanel.boundingBox();
    return Math.round(box?.width ?? 0);
  }).toBeLessThan(260);

  const narrowWidth = Math.round((await leftPanel.boundingBox())?.width ?? 0);

  expect(Math.abs(wideWidth - narrowWidth)).toBeLessThanOrEqual(16);

  await app.close();
});

test('activity bar shows compile, run, and debug action buttons with local selection only', async () => {
  const { app, window } = await launchApp();

  const compileButton = window.getByTestId('activity-action-compile');
  const runButton = window.getByTestId('activity-action-run');
  const debugButton = window.getByTestId('activity-action-debug-action');

  await expect(window.getByTitle('Settings')).toHaveCount(0);
  await expect(compileButton).toBeVisible();
  await expect(runButton).toBeVisible();
  await expect(debugButton).toBeVisible();

  await expect(compileButton).not.toHaveAttribute('aria-pressed', /.+/);
  await expect(runButton).not.toHaveAttribute('aria-pressed', /.+/);
  await expect(debugButton).not.toHaveAttribute('aria-pressed', /.+/);

  await runButton.click();
  await debugButton.click();
  await expect(compileButton).not.toHaveAttribute('aria-pressed', /.+/);
  await expect(runButton).not.toHaveAttribute('aria-pressed', /.+/);
  await expect(debugButton).not.toHaveAttribute('aria-pressed', /.+/);

  await expect(window.getByTestId('activity-item-explorer')).toHaveClass(/border-ide-accent/);

  await app.close();
});

test('editor split actions create additional groups and support vertical splitting', async () => {
  const { app, window } = await launchApp();
  const editorGroups = window.locator('[data-testid^="editor-group-group-"]');

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

test('focused split receives file tree opens and tabs can be dragged into another split', async () => {
  const { app, window } = await launchApp();

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

  await window.getByTestId('file-tree-node-README_md').click();

  const firstGroup = window.getByTestId('editor-group-group-1');
  await firstGroup.getByTestId('editor-split-right').click();

  await expect(window.getByTestId('editor-group-group-2')).toBeVisible();
  await firstGroup.getByTestId('editor-tab-close-README.md').click();

  await expect(window.getByTestId('editor-group-group-1')).toHaveCount(0);
  await expect(window.getByTestId('editor-group-group-2')).toBeVisible();

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

test('terminal uses the shared dracula theme and mono font at runtime', async () => {
  const { app, window } = await launchApp();

  await openBottomTerminal(window);

  const themeState = await readTerminalThemeSnapshot(window);
  expect(themeState.terminalBackground).toBeTruthy();
  expect(themeState.terminalFontFamilies.length).toBeGreaterThan(0);
  expect(themeState.expectedBackground).toBeTruthy();
  expect(themeState.terminalBackground).toBe(themeState.expectedBackground);
  expect(themeState.terminalFontFamilies.some((value) => value.toLowerCase().includes('jetbrains mono'))).toBe(true);

  await app.close();
});

test('terminal session survives tab switches and bottom panel hide/show', async () => {
  const { app, window } = await launchApp();
  const bottomPanel = window.locator('#bottom-panel');

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
  const bottomPanel = window.locator('#bottom-panel');
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

  await window.getByTitle('Close Panel').click();
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

  await app.close();
});

test('close button terminates the active terminal shell process', async () => {
  const { app, window } = await launchApp();

  await openBottomTerminal(window);

  await expect.poll(async () => readTerminalPid(window), {
    timeout: 15000,
  }).toBeGreaterThan(0);

  const pid = await readTerminalPid(window);
  expect(isProcessRunning(pid)).toBe(true);

  const closePromise = window.waitForEvent('close');
  await window.getByTestId('window-control-close').click();
  await closePromise;

  await expect.poll(() => isProcessRunning(pid), {
    timeout: 15000,
  }).toBe(false);

  await expect.poll(() => app.windows().length).toBe(0);
  await app.close();
});
