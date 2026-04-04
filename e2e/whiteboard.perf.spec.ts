import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureWorkspace = path.join(__dirname, '..', 'test', 'fixtures', 'workspace');

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

test.describe('whiteboard performance smoke', () => {
  test('opens the whiteboard and creates 20 nodes within a loose interaction budget', async () => {
    test.slow();

    const { app, window } = await launchApp();

    const startTime = Date.now();
    await window.getByTitle('Whiteboard').click();
    await expect(window.getByTestId('whiteboard-view')).toBeVisible();

    const addNodeButton = window.getByTestId('whiteboard-add-node');
    for (let index = 0; index < 20; index += 1) {
      await addNodeButton.click();
    }

    await expect(window.getByTestId('whiteboard-node-count')).toHaveText('Nodes: 20');

    const durationMs = Date.now() - startTime;
    expect(durationMs).toBeLessThan(10000);

    await app.close();
  });

  test('drags a whiteboard node and updates the drag status within a loose interaction budget', async () => {
    test.slow();

    const { app, window } = await launchApp();

    await window.getByTitle('Whiteboard').click();
    await expect(window.getByTestId('whiteboard-view')).toBeVisible();

    const addNodeButton = window.getByTestId('whiteboard-add-node');
    await addNodeButton.click();
    await expect(window.getByTestId('whiteboard-node-count')).toHaveText('Nodes: 1');

    const node = window.locator('.react-flow__node').filter({ hasText: 'Node 1' });
    await expect(node).toBeVisible();

    const box = await node.boundingBox();
    if (!box) {
      throw new Error('Node 1 bounding box was not available');
    }

    const startTime = Date.now();

    await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await window.mouse.down();
    await window.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 96, { steps: 16 });
    await window.mouse.up();

    await expect(window.getByTestId('whiteboard-last-dragged-node')).toContainText('node-1:');

    const durationMs = Date.now() - startTime;
    expect(durationMs).toBeLessThan(4000);

    await app.close();
  });
});