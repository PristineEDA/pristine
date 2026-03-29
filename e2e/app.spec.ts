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
      PRISTINE_PROJECT_ROOT: fixtureWorkspace,
    },
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  return { app, window };
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

test('ctrl+p quick open searches files, navigates results, and reveals the selected file', async () => {
  const { app, window } = await launchApp();

  await window.keyboard.press('Control+P');

  const quickOpen = window.getByTestId('quick-open-overlay');
  const quickOpenInput = window.getByTestId('quick-open-input');
  await expect(quickOpen).toBeVisible();
  await expect(quickOpenInput).toBeFocused();
  await expect(window.getByTestId('quick-open-result-rtl_core_reg_file_v')).toBeVisible();

  await quickOpenInput.fill('reg');
  await expect(window.getByTestId('quick-open-result-rtl_core_reg_file_v')).toBeVisible();
  await quickOpenInput.press('Enter');

  await expect(quickOpen).toHaveCount(0);
  await expect(window.getByTestId('editor-tab-rtl/core/reg_file.v')).toBeVisible();
  await expect(window.getByTestId('file-tree-node-rtl')).toBeVisible();
  await expect(window.getByTestId('file-tree-node-rtl_core')).toBeVisible();
  await expect(window.getByTestId('file-tree-node-rtl_core_reg_file_v')).toBeVisible();

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
  await expect(window.getByTestId('activity-item-git')).toBeVisible();
  await expect(window.getByTestId('activity-item-debug')).toBeVisible();
  await expect(window.getByTestId('activity-item-search')).toHaveCount(0);
  await expect(window.getByTestId('activity-item-extensions')).toHaveCount(0);

  const explorerFileNode = window.getByTestId('file-tree-node-README_md');
  await expect(explorerFileNode).toBeVisible();

  const explorerButton = window.getByTestId('activity-item-explorer');
  await explorerButton.click();
  await expect(explorerFileNode).toHaveCount(0);
  await expect(explorerButton).toHaveClass(/border-ide-accent/);

  const sourceControlButton = window.getByTestId('activity-item-git');
  await sourceControlButton.click();
  await expect(explorerFileNode).toBeVisible();
  await expect(sourceControlButton).toHaveClass(/border-ide-accent/);

  await sourceControlButton.click();
  await expect(explorerFileNode).toHaveCount(0);
  await expect(sourceControlButton).toHaveClass(/border-ide-accent/);

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
