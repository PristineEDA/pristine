export const DEFAULT_PRISTINE_ENGINE_REPOSITORY = 'PristineEDA/pristine-engine'
export const DEFAULT_PRISTINE_ENGINE_ARTIFACT_BRANCH = 'main'
export const DEFAULT_PRISTINE_ENGINE_ARTIFACT_WORKFLOW = 'ci.yml'

const VALID_REMOTE_SOURCE_MODES = new Set(['auto', 'artifact', 'release'])

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, '')
}

export function isGitTagRef(ref = '') {
  return ref.startsWith('refs/tags/')
}

export function getRemoteSourceMode({ mode = 'auto', ref = '' } = {}) {
  if (!VALID_REMOTE_SOURCE_MODES.has(mode)) {
    throw new Error(`Unsupported pristine-engine remote source mode: ${mode}`)
  }

  if (mode !== 'auto') {
    return mode
  }

  return isGitTagRef(ref) ? 'release' : 'artifact'
}

export function getPreferredPlatformAssetId({
  platform = process.platform,
  arch = process.arch,
  imageOS = process.env.ImageOS ?? '',
} = {}) {
  const normalizedImageOS = imageOS.toLowerCase()

  if (platform === 'win32') {
    if (normalizedImageOS.includes('win22') || normalizedImageOS.includes('windows2022')) {
      return `windows-2022-${arch}`
    }

    if (normalizedImageOS.includes('win25') || normalizedImageOS.includes('windows2025')) {
      return `windows-2025-${arch}`
    }

    return null
  }

  if (platform === 'linux') {
    if (normalizedImageOS.includes('ubuntu22') || normalizedImageOS.includes('ubuntu-22')) {
      return `ubuntu-22.04-${arch}`
    }

    if (normalizedImageOS.includes('ubuntu24') || normalizedImageOS.includes('ubuntu-24')) {
      return `ubuntu-24.04-${arch}`
    }

    return null
  }

  if (platform === 'darwin') {
    if (normalizedImageOS.includes('macos15') || normalizedImageOS.includes('macos-15')) {
      return `macos-15-${arch}`
    }

    if (normalizedImageOS.includes('macos26') || normalizedImageOS.includes('macos-26')) {
      return `macos-26-${arch}`
    }
  }

  return null
}

export function getPlatformAssetIds({
  platform = process.platform,
  arch = process.arch,
  imageOS = process.env.ImageOS ?? '',
} = {}) {
  if (arch !== 'x64' && arch !== 'arm64') {
    throw new Error(`Unsupported pristine-engine architecture: ${arch}`)
  }

  if (platform === 'win32') {
    if (arch !== 'x64') {
      throw new Error(`Unsupported pristine-engine architecture for Windows: ${arch}`)
    }

    return unique([
      getPreferredPlatformAssetId({ platform, arch, imageOS }),
      `windows-${arch}`,
      `windows-2025-${arch}`,
      `windows-2022-${arch}`,
    ])
  }

  if (platform === 'linux') {
    if (arch !== 'x64') {
      throw new Error(`Unsupported pristine-engine architecture for Linux: ${arch}`)
    }

    return unique([
      getPreferredPlatformAssetId({ platform, arch, imageOS }),
      `linux-${arch}`,
      `ubuntu-24.04-${arch}`,
      `ubuntu-22.04-${arch}`,
    ])
  }

  if (platform === 'darwin') {
    return unique([
      getPreferredPlatformAssetId({ platform, arch, imageOS }),
      `macos-${arch}`,
      `macos-26-${arch}`,
      `macos-15-${arch}`,
    ])
  }

  return []
}

export function getReleaseAssetCandidates({
  releaseTag,
  explicitAsset,
  platform = process.platform,
  arch = process.arch,
  imageOS = process.env.ImageOS ?? '',
} = {}) {
  if (explicitAsset) {
    return [explicitAsset]
  }

  if (!releaseTag) {
    throw new Error('A pristine-engine release tag is required to choose release assets')
  }

  return getPlatformAssetIds({ platform, arch, imageOS }).flatMap((assetId) => [
    `pristine-engine-${releaseTag}-${assetId}.zip`,
    `pristine-engine-${assetId}.zip`,
  ])
}

export function getWorkflowArtifactCandidates({
  explicitArtifact,
  platform = process.platform,
  arch = process.arch,
  imageOS = process.env.ImageOS ?? '',
} = {}) {
  if (explicitArtifact) {
    return [explicitArtifact]
  }

  return getPlatformAssetIds({ platform, arch, imageOS }).map((assetId) => `pristine-engine-${assetId}`)
}

export function getGitHubApiHeaders(env = process.env) {
  const token = env.PRISTINE_ENGINE_GITHUB_TOKEN ?? env.GITHUB_TOKEN ?? env.GH_TOKEN
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'pristine-engine-prepare',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

export function getGitHubApiUrl(repository, route, env = process.env) {
  const baseUrl = trimSlashes(env.PRISTINE_ENGINE_GITHUB_API_URL ?? 'https://api.github.com')
  return `${baseUrl}/repos/${repository}/${trimSlashes(route)}`
}

function pickByName(items, candidates) {
  return candidates.flatMap((candidate) => items.filter((item) => item.name === candidate))[0] ?? null
}

export function pickReleaseAsset(release, candidates) {
  return pickByName(release?.assets ?? [], candidates)
}

export function pickWorkflowArtifact(artifacts, candidates) {
  return pickByName(artifacts ?? [], candidates)
}

async function fetchGitHubJson(url, label, env = process.env) {
  const response = await fetch(url, { headers: getGitHubApiHeaders(env) })

  if (!response.ok) {
    throw new Error(`Failed to query ${label}: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function resolveReleaseDownload({
  repository = DEFAULT_PRISTINE_ENGINE_REPOSITORY,
  releaseVersion,
  explicitAsset,
  platform = process.platform,
  arch = process.arch,
  imageOS = process.env.ImageOS ?? '',
  env = process.env,
} = {}) {
  const releaseRoute = releaseVersion ? `releases/tags/${releaseVersion}` : 'releases/latest'
  const release = await fetchGitHubJson(
    getGitHubApiUrl(repository, releaseRoute, env),
    `pristine-engine ${releaseVersion ? `release ${releaseVersion}` : 'latest release'}`,
    env,
  )
  const releaseTag = release.tag_name
  const candidates = getReleaseAssetCandidates({ releaseTag, explicitAsset, platform, arch, imageOS })

  if (candidates.length === 0) {
    return null
  }

  const asset = pickReleaseAsset(release, candidates)
  if (!asset?.browser_download_url) {
    throw new Error(
      `Unable to find a pristine-engine release asset in ${repository}@${releaseTag}. Tried: ${candidates.join(', ')}`,
    )
  }

  return {
    archiveFile: asset.name,
    archiveUrl: asset.browser_download_url,
    releaseTag,
    sourceLabel: `GitHub release ${releaseTag}`,
  }
}

export async function resolveWorkflowArtifactDownload({
  repository = DEFAULT_PRISTINE_ENGINE_REPOSITORY,
  workflow = DEFAULT_PRISTINE_ENGINE_ARTIFACT_WORKFLOW,
  branch = DEFAULT_PRISTINE_ENGINE_ARTIFACT_BRANCH,
  explicitArtifact,
  platform = process.platform,
  arch = process.arch,
  imageOS = process.env.ImageOS ?? '',
  env = process.env,
} = {}) {
  const candidates = getWorkflowArtifactCandidates({ explicitArtifact, platform, arch, imageOS })
  if (candidates.length === 0) {
    return null
  }

  const runsUrl = new URL(getGitHubApiUrl(repository, `actions/workflows/${workflow}/runs`, env))
  runsUrl.searchParams.set('branch', branch)
  runsUrl.searchParams.set('event', 'push')
  runsUrl.searchParams.set('status', 'success')
  runsUrl.searchParams.set('per_page', '20')

  const runs = await fetchGitHubJson(
    runsUrl.toString(),
    `latest successful pristine-engine workflow run on ${branch}`,
    env,
  )
  const run = (runs.workflow_runs ?? []).find((entry) => entry.conclusion === 'success')

  if (!run?.id) {
    throw new Error(`Unable to find a successful pristine-engine workflow run for ${repository}@${branch}`)
  }

  const artifacts = await fetchGitHubJson(
    getGitHubApiUrl(repository, `actions/runs/${run.id}/artifacts?per_page=100`, env),
    `pristine-engine artifacts for workflow run ${run.id}`,
    env,
  )
  const artifact = pickWorkflowArtifact(artifacts.artifacts, candidates)

  if (!artifact?.archive_download_url) {
    throw new Error(
      `Unable to find a pristine-engine workflow artifact in ${repository} run ${run.id}. Tried: ${candidates.join(', ')}`,
    )
  }

  return {
    archiveFile: `${artifact.name}.zip`,
    archiveUrl: artifact.archive_download_url,
    artifactName: artifact.name,
    runId: run.id,
    sourceLabel: `GitHub Actions artifact ${artifact.name} from run ${run.id}`,
  }
}