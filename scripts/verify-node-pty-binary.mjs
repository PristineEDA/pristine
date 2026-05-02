import path from 'node:path'
import { access, stat } from 'node:fs/promises'

const workspaceRoot = process.cwd()
const nodePtyDir = path.join(workspaceRoot, 'node_modules', 'node-pty')

function parseArgs(argv) {
  const result = {
    platform: process.platform,
    arch: process.arch,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const nextValue = argv[index + 1]

    if (argument === '--') {
      continue
    }

    if (argument === '--platform') {
      if (!nextValue) {
        throw new Error('Missing value for --platform')
      }

      result.platform = nextValue
      index += 1
      continue
    }

    if (argument === '--arch') {
      if (!nextValue) {
        throw new Error('Missing value for --arch')
      }

      result.arch = nextValue
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  return result
}

function getRequiredEntries(platform) {
  if (platform === 'win32') {
    return [
      'conpty.node',
      'conpty_console_list.node',
      'pty.node',
      'winpty-agent.exe',
      'winpty.dll',
    ]
  }

  return ['pty.node']
}

async function directoryExists(directoryPath) {
  try {
    const directoryStats = await stat(directoryPath)
    return directoryStats.isDirectory()
  } catch {
    return false
  }
}

async function hasRequiredEntries(directoryPath, requiredEntries) {
  for (const requiredEntry of requiredEntries) {
    try {
      await access(path.join(directoryPath, requiredEntry))
    } catch {
      return false
    }
  }

  return true
}

async function resolveCandidate(directoryPath, requiredEntries) {
  if (!(await directoryExists(directoryPath))) {
    return null
  }

  if (!(await hasRequiredEntries(directoryPath, requiredEntries))) {
    return null
  }

  return directoryPath
}

async function main() {
  const { platform, arch } = parseArgs(process.argv.slice(2))
  const requiredEntries = getRequiredEntries(platform)
  const prebuildDirectory = path.join(nodePtyDir, 'prebuilds', `${platform}-${arch}`)

  const candidates = [
    {
      label: 'prebuild',
      directoryPath: prebuildDirectory,
    },
  ]

  if (platform === process.platform && arch === process.arch) {
    candidates.unshift({
      label: 'build',
      directoryPath: path.join(nodePtyDir, 'build', 'Release'),
    })
  }

  for (const candidate of candidates) {
    const resolvedPath = await resolveCandidate(candidate.directoryPath, requiredEntries)

    if (resolvedPath) {
      console.log(
        `Verified node-pty ${candidate.label} native binaries for ${platform}-${arch}: ${path.relative(workspaceRoot, resolvedPath)}`,
      )
      return
    }
  }

  const attemptedPaths = candidates
    .map((candidate) => path.relative(workspaceRoot, candidate.directoryPath))
    .join(', ')

  throw new Error(
    `Missing usable node-pty native binaries for ${platform}-${arch}. Checked: ${attemptedPaths}. Expected files: ${requiredEntries.join(', ')}`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})