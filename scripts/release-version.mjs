import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const packageJsonPaths = ['package.json'];
const versionPattern = /(?:^|\/)v?(\d+\.\d+\.\d+)(?:$|[^0-9.])/;

export function extractReleaseVersion(refName) {
  if (typeof refName !== 'string') {
    return null;
  }

  const match = refName.match(versionPattern);
  return match?.[1] ?? null;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {
    command,
    ref: process.env.GITHUB_REF ?? '',
    root: process.cwd(),
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const nextValue = rest[index + 1];

    if (arg === '--ref' && nextValue) {
      options.ref = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--root' && nextValue) {
      options.root = path.resolve(nextValue);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function readPackageJson(root, relativePath) {
  const filePath = path.join(root, relativePath);
  const raw = await readFile(filePath, 'utf8');
  return {
    filePath,
    manifest: JSON.parse(raw),
  };
}

async function writePackageJson(filePath, manifest) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function readPackageVersions(root) {
  const entries = await Promise.all(
    packageJsonPaths.map(async (relativePath) => {
      const { manifest } = await readPackageJson(root, relativePath);
      return [relativePath, manifest.version];
    }),
  );

  return Object.fromEntries(entries);
}

async function checkReleaseVersion(root, refName) {
  const version = extractReleaseVersion(refName);

  if (!version) {
    throw new Error(`Release ref does not contain a semver version: ${refName || '<empty>'}`);
  }

  const versions = await readPackageVersions(root);
  const mismatches = Object.entries(versions)
    .filter(([, packageVersion]) => packageVersion !== version)
    .map(([relativePath, packageVersion]) => `${relativePath} has ${packageVersion}, expected ${version}`);

  if (mismatches.length > 0) {
    throw new Error(`Release version mismatch for ${refName}:\n${mismatches.join('\n')}`);
  }

  console.log(`Release version ${version} matches ${packageJsonPaths.join(', ')}`);
}

async function syncReleaseVersion(root, refName) {
  const version = extractReleaseVersion(refName);

  if (!version) {
    console.log(`No release version found in ${refName || '<empty>'}; skipping package version sync.`);
    return;
  }

  const updatedPaths = [];

  for (const relativePath of packageJsonPaths) {
    const { filePath, manifest } = await readPackageJson(root, relativePath);

    if (manifest.version === version) {
      continue;
    }

    manifest.version = version;
    await writePackageJson(filePath, manifest);
    updatedPaths.push(relativePath);
  }

  if (updatedPaths.length === 0) {
    console.log(`Release version ${version} is already synced.`);
    return;
  }

  console.log(`Synced release version ${version}: ${updatedPaths.join(', ')}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.command === 'check') {
    await checkReleaseVersion(options.root, options.ref);
    return;
  }

  if (options.command === 'sync') {
    await syncReleaseVersion(options.root, options.ref);
    return;
  }

  throw new Error('Usage: node scripts/release-version.mjs <check|sync> [--ref <ref>] [--root <path>]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
