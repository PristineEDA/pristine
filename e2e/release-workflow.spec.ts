import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const releaseScriptPath = path.join(repoRoot, 'scripts', 'release-version.mjs');

function createPackageFixture(version = '0.0.1') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pristine-release-e2e-'));
  const agentServerRoot = path.join(root, 'agent-server');

  fs.mkdirSync(agentServerRoot, { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'pristine', version }, null, 2));
  fs.writeFileSync(
    path.join(agentServerRoot, 'package.json'),
    JSON.stringify({ name: '@pristine/agent-server', version }, null, 2),
  );

  return root;
}

test('release version tooling supports branch sync and tag verification', () => {
  const root = createPackageFixture();

  execFileSync(process.execPath, [releaseScriptPath, 'sync', '--ref', 'release/v2.3.4', '--root', root], {
    cwd: repoRoot,
    stdio: 'pipe',
  });

  const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const agentServerPackage = JSON.parse(fs.readFileSync(path.join(root, 'agent-server', 'package.json'), 'utf8'));

  expect(rootPackage.version).toBe('2.3.4');
  expect(agentServerPackage.version).toBe('2.3.4');

  const checkOutput = execFileSync(
    process.execPath,
    [releaseScriptPath, 'check', '--ref', 'refs/tags/v2.3.4', '--root', root],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  expect(checkOutput).toContain('Release version 2.3.4 matches package.json, agent-server/package.json');
});

test('GitHub release workflow is tag-gated and publishes staged package assets', () => {
  const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
  const prepareEngineScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'prepare-pristine-engine.mjs'), 'utf8');
  const engineRemoteSourceHelper = fs.readFileSync(path.join(repoRoot, 'scripts', 'pristine-engine-remote-source.mjs'), 'utf8');
  const hook = fs.readFileSync(path.join(repoRoot, '.githooks', 'pre-commit'), 'utf8');

  expect(workflow).toContain('refs/tags/v*');
  expect(workflow).toContain('PRISTINE_ENGINE_REMOTE_SOURCE_MODE: auto');
  expect(workflow).toContain('PRISTINE_ENGINE_ARTIFACT_BRANCH: main');
  expect(workflow).toContain('permissions: read-all');
  expect(workflow).toContain('actions: read');
  expect(workflow).toContain('github-release:');
  expect(workflow).toContain('needs.package-gate.outputs.enabled');
  expect(workflow).toContain('node scripts/release-version.mjs check --ref "${GITHUB_REF}"');
  expect(workflow).toContain('actions/download-artifact@v4');
  expect(workflow).toContain('pattern: pristine-*');
  expect(workflow).toContain('release-assets/*');
  expect(workflow).toContain('softprops/action-gh-release@v2');
  expect(workflow).toContain('generate_release_notes: true');
  expect(workflow).toContain('!release/**/*-unpacked/**');
  expect(prepareEngineScript).toContain('resolveWorkflowArtifactDownload');
  expect(prepareEngineScript).toContain('resolveReleaseDownload');
  expect(prepareEngineScript).toContain('process.env.GITHUB_REF');
  expect(engineRemoteSourceHelper).toContain("return isGitTagRef(ref) ? 'release' : 'artifact'");
  expect(engineRemoteSourceHelper).toContain("const releaseRoute = releaseVersion ? `releases/tags/${releaseVersion}` : 'releases/latest'");
  expect(engineRemoteSourceHelper).toContain("runsUrl.searchParams.set('branch', branch)");
  expect(hook).toContain('node scripts/release-version.mjs sync --ref "$BRANCH"');
});
