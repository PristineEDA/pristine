import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(__dirname, '..')
const releaseScriptPath = path.join(repoRoot, 'scripts', 'release-version.mjs')
const workflowPath = path.join(repoRoot, '.github', 'workflows', 'ci.yml')
const prepareEngineScriptPath = path.join(repoRoot, 'scripts', 'prepare-pristine-engine.mjs')
const engineRemoteSourceHelperPath = path.join(repoRoot, 'scripts', 'pristine-engine-remote-source.mjs')
const hookPath = path.join(repoRoot, '.githooks', 'pre-commit')

function createPackageFixture(rootVersion = '0.0.1', agentServerVersion = rootVersion) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pristine-release-version-'))
  const agentServerRoot = path.join(root, 'agent-server')

  fs.mkdirSync(agentServerRoot, { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'pristine', version: rootVersion }, null, 2))
  fs.writeFileSync(
    path.join(agentServerRoot, 'package.json'),
    JSON.stringify({ name: '@pristine/agent-server', version: agentServerVersion }, null, 2),
  )

  return root
}

function readFixtureVersion(root: string, relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')).version as string
}

function runReleaseScript(root: string, args: string[]) {
  const result = spawnSync(
    process.execPath,
    [releaseScriptPath, ...args, '--root', root],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
    },
  )

  if (result.error) {
    throw result.error
  }

  return result
}

describe('release workflow contract', () => {
  it('syncs root and agent-server package versions from release branch names', () => {
    const root = createPackageFixture()

    const result = runReleaseScript(root, ['sync', '--ref', 'release/v1.2.3'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Synced release version 1.2.3')
    expect(readFixtureVersion(root, 'package.json')).toBe('1.2.3')
    expect(readFixtureVersion(root, 'agent-server/package.json')).toBe('1.2.3')
  })

  it('fails release checks when package versions do not match the tag', () => {
    const root = createPackageFixture('1.2.3', '1.2.4')

    const result = runReleaseScript(root, ['check', '--ref', 'refs/tags/v1.2.3'])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Release version mismatch')
    expect(result.stderr).toContain('agent-server/package.json has 1.2.4, expected 1.2.3')
  })

  it('accepts tag checks when all package versions match', () => {
    const root = createPackageFixture('1.2.3')

    const result = runReleaseScript(root, ['check', '--ref', 'refs/tags/v1.2.3'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Release version 1.2.3 matches package.json, agent-server/package.json')
  })

  it('keeps the local hook scoped to package version sync', () => {
    const hook = fs.readFileSync(hookPath, 'utf8')

    expect(hook).toContain('node scripts/release-version.mjs sync --ref "$BRANCH"')
    expect(hook).toContain('git add package.json agent-server/package.json')
    expect(hook).toContain('grep -oE')
  })

  it('publishes release assets only from version-checked tag package builds', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8')

    expect(workflow).toContain('refs/tags/v*')
    expect(workflow).toContain('node scripts/release-version.mjs check --ref "${GITHUB_REF}"')
    expect(workflow).toContain('github-release:')
    expect(workflow).toContain("if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')")
    expect(workflow).toContain('pattern: pristine-*')
    expect(workflow).toContain('softprops/action-gh-release@v2')
    expect(workflow).toContain('generate_release_notes: true')
    expect(workflow).toContain('contents: write')
    expect(workflow).not.toMatch(/^  release:/m)
  })

  it('keeps CI manually dispatchable with explicit read permissions', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8')

    expect(workflow).toMatch(/on:\r?\n  push:\r?\n  pull_request:\r?\n  workflow_dispatch:/)
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toMatch(/permissions:\r?\n  actions: read\r?\n  contents: read/)
    expect(workflow).not.toContain('permissions: read-all')
    expect(workflow).not.toMatch(/push:\r?\n\s+branches:/)
    expect(workflow).not.toMatch(/push:[\s\S]*?\r?\n\s+tags:/)
  })

  it('routes pristine-engine downloads to main workflow artifacts for non-tags and latest releases for tags', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8')
    const prepareEngineScript = fs.readFileSync(prepareEngineScriptPath, 'utf8')
    const engineRemoteSourceHelper = fs.readFileSync(engineRemoteSourceHelperPath, 'utf8')

    expect(workflow).toContain('PRISTINE_ENGINE_REPOSITORY: PristineEDA/pristine-engine')
    expect(workflow).toContain('PRISTINE_ENGINE_REMOTE_SOURCE_MODE: auto')
    expect(workflow).toContain('PRISTINE_ENGINE_ARTIFACT_BRANCH: main')
    expect(workflow).toContain('PRISTINE_ENGINE_ARTIFACT_WORKFLOW: ci.yml')
    expect(workflow).toContain('actions: read')

    expect(prepareEngineScript).toContain('getRemoteSourceMode')
    expect(prepareEngineScript).toContain('resolveWorkflowArtifactDownload')
    expect(prepareEngineScript).toContain('resolveReleaseDownload')
    expect(prepareEngineScript).toContain('process.env.GITHUB_REF')
    expect(prepareEngineScript).not.toContain("?? 'v0.1.1'")

    expect(engineRemoteSourceHelper).toContain("return isGitTagRef(ref) ? 'release' : 'artifact'")
    expect(engineRemoteSourceHelper).toContain("const releaseRoute = releaseVersion ? `releases/tags/${releaseVersion}` : 'releases/latest'")
    expect(engineRemoteSourceHelper).toContain("runsUrl.searchParams.set('branch', branch)")
    expect(engineRemoteSourceHelper).toContain("runsUrl.searchParams.set('status', 'success')")
  })

  it('filters uploaded package artifacts to distributable release files', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8')

    expect(workflow).toContain('release/**/*.AppImage')
    expect(workflow).toContain('release/**/*.blockmap')
    expect(workflow).toContain('release/**/*.deb')
    expect(workflow).toContain('release/**/*.dmg')
    expect(workflow).toContain('release/**/*.exe')
    expect(workflow).toContain('release/**/*.yml')
    expect(workflow).toContain('!release/**/*-unpacked/**')
    expect(workflow).toContain("target=\"release-assets/${artifact_name}-${file_name}\"")
  })
})
