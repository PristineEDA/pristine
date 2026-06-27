import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '..');
const requireFromWorkspace = createRequire(path.join(workspaceRoot, 'package.json'));
const electronBuilderEntry = requireFromWorkspace.resolve('electron-builder');
const requireFromElectronBuilder = createRequire(electronBuilderEntry);
const { rebuild } = requireFromElectronBuilder('@electron/rebuild');
const electronPackagePath = path.join(workspaceRoot, 'node_modules', 'electron', 'package.json');
const electronPackage = JSON.parse(await readFile(electronPackagePath, 'utf-8'));

await rebuild({
  buildPath: workspaceRoot,
  electronVersion: electronPackage.version,
  onlyModules: ['better-sqlite3'],
  force: false,
});
