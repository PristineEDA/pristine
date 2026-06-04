import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

const repoRoot = path.resolve(__dirname, '..')
const remoteSourceHelperPath = path.join(repoRoot, 'scripts', 'pristine-engine-remote-source.mjs')

interface RemoteSourceHelper {
  getRemoteSourceMode(options?: { mode?: string; ref?: string }): string
  getReleaseAssetCandidates(options: {
    releaseTag: string
    platform: NodeJS.Platform
    arch: NodeJS.Architecture
    imageOS?: string
    explicitAsset?: string
  }): string[]
  getWorkflowArtifactCandidates(options: {
    platform: NodeJS.Platform
    arch: NodeJS.Architecture
    imageOS?: string
    explicitArtifact?: string
  }): string[]
  pickReleaseAsset(release: { assets: Array<{ name: string }> }, candidates: string[]): { name: string } | null
  pickWorkflowArtifact(artifacts: Array<{ name: string }>, candidates: string[]): { name: string } | null
  resolveReleaseDownload(options: {
    repository: string
    platform: NodeJS.Platform
    arch: NodeJS.Architecture
    imageOS?: string
    env?: NodeJS.ProcessEnv
  }): Promise<{ archiveFile: string; archiveUrl: string; releaseTag: string }>
  resolveWorkflowArtifactDownload(options: {
    repository: string
    workflow: string
    branch: string
    platform: NodeJS.Platform
    arch: NodeJS.Architecture
    imageOS?: string
    env?: NodeJS.ProcessEnv
  }): Promise<{ archiveFile: string; archiveUrl: string; artifactName: string; runId: number }>
}

async function loadRemoteSourceHelper() {
  return await import(pathToFileURL(remoteSourceHelperPath).href) as RemoteSourceHelper
}

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

describe('pristine-engine remote source selection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('routes automatic CI downloads to release assets for tags and workflow artifacts otherwise', async () => {
    const helper = await loadRemoteSourceHelper()

    expect(helper.getRemoteSourceMode({ mode: 'auto', ref: 'refs/tags/v1.2.3' })).toBe('release')
    expect(helper.getRemoteSourceMode({ mode: 'auto', ref: 'refs/heads/main' })).toBe('artifact')
    expect(helper.getRemoteSourceMode({ mode: 'release', ref: 'refs/heads/main' })).toBe('release')
    expect(helper.getRemoteSourceMode({ mode: 'artifact', ref: 'refs/tags/v1.2.3' })).toBe('artifact')
  })

  it('prefers runner-specific release and workflow artifact names before generic fallbacks', async () => {
    const helper = await loadRemoteSourceHelper()

    expect(helper.getReleaseAssetCandidates({
      releaseTag: 'v1.2.3',
      platform: 'win32',
      arch: 'x64',
      imageOS: 'win25',
    })).toEqual([
      'pristine-engine-v1.2.3-windows-2025-x64.zip',
      'pristine-engine-windows-2025-x64.zip',
      'pristine-engine-v1.2.3-windows-x64.zip',
      'pristine-engine-windows-x64.zip',
      'pristine-engine-v1.2.3-windows-2022-x64.zip',
      'pristine-engine-windows-2022-x64.zip',
    ])

    expect(helper.getWorkflowArtifactCandidates({
      platform: 'linux',
      arch: 'x64',
      imageOS: 'ubuntu24',
    })).toEqual([
      'pristine-engine-ubuntu-24.04-x64',
      'pristine-engine-linux-x64',
      'pristine-engine-ubuntu-22.04-x64',
    ])
  })

  it('selects matching release assets and workflow artifacts by candidate priority', async () => {
    const helper = await loadRemoteSourceHelper()

    expect(helper.pickReleaseAsset({
      assets: [
        { name: 'pristine-engine-windows-x64.zip' },
        { name: 'pristine-engine-v1.2.3-windows-2025-x64.zip' },
      ],
    }, [
      'pristine-engine-v1.2.3-windows-2025-x64.zip',
      'pristine-engine-windows-x64.zip',
    ])).toEqual({ name: 'pristine-engine-v1.2.3-windows-2025-x64.zip' })

    expect(helper.pickWorkflowArtifact([
      { name: 'pristine-engine-linux-x64' },
      { name: 'pristine-engine-ubuntu-24.04-x64' },
    ], [
      'pristine-engine-ubuntu-24.04-x64',
      'pristine-engine-linux-x64',
    ])).toEqual({ name: 'pristine-engine-ubuntu-24.04-x64' })
  })

  it('resolves the latest GitHub release asset when no release version is pinned', async () => {
    const fetchMock = vi.fn(async () => createJsonResponse({
      tag_name: 'v9.8.7',
      assets: [
        {
          name: 'pristine-engine-v9.8.7-windows-2025-x64.zip',
          browser_download_url: 'https://github.com/PristineEDA/pristine-engine/releases/download/v9.8.7/pristine-engine-v9.8.7-windows-2025-x64.zip',
        },
      ],
    }))
    vi.stubGlobal('fetch', fetchMock)
    const helper = await loadRemoteSourceHelper()

    const download = await helper.resolveReleaseDownload({
      repository: 'PristineEDA/pristine-engine',
      platform: 'win32',
      arch: 'x64',
      imageOS: 'win25',
      env: {},
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/PristineEDA/pristine-engine/releases/latest',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/vnd.github+json' }) }),
    )
    expect(download).toMatchObject({
      archiveFile: 'pristine-engine-v9.8.7-windows-2025-x64.zip',
      releaseTag: 'v9.8.7',
    })
  })

  it('resolves the latest successful main workflow artifact for non-tag builds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({
        workflow_runs: [
          { conclusion: 'success', id: 12345 },
        ],
      }))
      .mockResolvedValueOnce(createJsonResponse({
        artifacts: [
          {
            name: 'pristine-engine-ubuntu-24.04-x64',
            archive_download_url: 'https://api.github.com/repos/PristineEDA/pristine-engine/actions/artifacts/67890/zip',
          },
        ],
      }))
    vi.stubGlobal('fetch', fetchMock)
    const helper = await loadRemoteSourceHelper()

    const download = await helper.resolveWorkflowArtifactDownload({
      repository: 'PristineEDA/pristine-engine',
      workflow: 'ci.yml',
      branch: 'main',
      platform: 'linux',
      arch: 'x64',
      imageOS: 'ubuntu24',
      env: {},
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.github.com/repos/PristineEDA/pristine-engine/actions/workflows/ci.yml/runs?branch=main&event=push&status=success&per_page=20',
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/repos/PristineEDA/pristine-engine/actions/runs/12345/artifacts?per_page=100',
      expect.any(Object),
    )
    expect(download).toMatchObject({
      archiveFile: 'pristine-engine-ubuntu-24.04-x64.zip',
      artifactName: 'pristine-engine-ubuntu-24.04-x64',
      runId: 12345,
    })
  })
})
