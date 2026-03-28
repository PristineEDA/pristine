import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test('app launches and shows main UI', async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..', 'dist-electron', 'main.js')],
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  const title = await window.title();
  expect(title).toContain('Pristine');

  await app.close();
});
