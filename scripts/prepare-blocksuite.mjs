import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');
const configPath = path.join(projectRoot, 'config', 'blocksuite-upstream.json');
const verifyOnly = process.argv.includes('--verify');
const networkGitRetryCount = 3;

function isRetryableGitError(error) {
  const message = [
    error instanceof Error ? error.message : '',
    error?.stderr?.toString?.() ?? '',
    error?.stdout?.toString?.() ?? '',
  ].join('\n');

  return /unable to access|could not resolve host|failed to connect|connection timed out|operation timed out|rpc failed|early eof|http 5\d\d|tls/i.test(message);
}

function runGit(args, options = {}) {
  let lastError = null;
  const { retry = false, ...execOptions } = options;
  const attempts = retry ? networkGitRetryCount : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const output = execFileSync('git', args, {
        encoding: 'utf8',
        stdio: execOptions.stdio ?? ['ignore', 'pipe', 'pipe'],
        ...execOptions,
      });

      return typeof output === 'string' ? output.trim() : '';
    } catch (error) {
      lastError = error;

      if (!retry || attempt === attempts || !isRetryableGitError(error)) {
        throw error;
      }

      console.warn(`git ${args[0]} failed; retrying (${attempt + 1}/${attempts})...`);
    }
  }

  throw lastError;
}

function getLocalSourcePath() {
  const localSource = process.env.PRISTINE_BLOCKSUITE_SOURCE_DIR;

  if (!localSource) {
    return null;
  }

  return path.resolve(localSource);
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

async function readConfig() {
  const raw = await readFile(configPath, 'utf8');
  return JSON.parse(raw);
}

function getVendorPath(config) {
  return path.join(projectRoot, config.vendorRoot, config.workspaceName);
}

function getMarkerPath(vendorPath) {
  return path.join(vendorPath, '.pristine-blocksuite.json');
}

async function readMarker(vendorPath) {
  const markerPath = getMarkerPath(vendorPath);

  if (!existsSync(markerPath)) {
    return null;
  }

  const raw = await readFile(markerPath, 'utf8');
  return JSON.parse(raw);
}

function requiredPathsExist(vendorPath, config) {
  return config.requiredPackagePaths.every((relativePath) => existsSync(path.join(vendorPath, relativePath)));
}

async function isPrepared(vendorPath, config) {
  const marker = await readMarker(vendorPath);

  return Boolean(
    marker &&
      marker.repository === config.repository &&
      marker.tag === config.tag &&
      marker.resolvedCommit === config.resolvedCommit &&
      requiredPathsExist(vendorPath, config),
  );
}

function resolveTagCommit(config) {
  const peeledRef = `refs/tags/${config.tag}^{}`;
  const tagRef = `refs/tags/${config.tag}`;

  try {
    const output = runGit(['ls-remote', '--tags', config.repository, peeledRef], { retry: true });
    const [commit] = output.split(/\s+/);

    if (commit) {
      return commit;
    }
  } catch {
    // Lightweight tags do not have a peeled ref.
  }

  const output = runGit(['ls-remote', '--tags', config.repository, tagRef], { retry: true });
  const [commit] = output.split(/\s+/);

  if (!commit) {
    throw new Error(`Unable to resolve AFFiNE tag ${config.tag}`);
  }

  return commit;
}

async function writeMarker(vendorPath, config) {
  const marker = {
    repository: config.repository,
    tag: config.tag,
    resolvedCommit: config.resolvedCommit,
    sparsePaths: config.sparsePaths,
    requiredPackagePaths: config.requiredPackagePaths,
    referencePackagePaths: config.referencePackagePaths ?? [],
    preparedAt: new Date().toISOString(),
  };

  await writeFile(getMarkerPath(vendorPath), `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
}

async function copySparseCheckout(sourcePath, vendorPath, config) {
  await rm(vendorPath, { recursive: true, force: true });
  await mkdir(vendorPath, { recursive: true });

  for (const relativePath of config.sparsePaths) {
    const source = path.join(sourcePath, relativePath);
    const target = path.join(vendorPath, relativePath);

    if (!existsSync(source)) {
      throw new Error(`AFFiNE sparse checkout is missing ${relativePath}`);
    }

    await mkdir(path.dirname(target), { recursive: true });
    await cp(source, target, {
      recursive: true,
      force: true,
      filter: (entry) => {
        const normalized = toPosixPath(entry);
        return !normalized.includes('/node_modules/') && !normalized.includes('/dist/') && !normalized.includes('/.git/');
      },
    });
  }
}

async function cloneAffine(config) {
  const tempRoot = await mkdir(path.join(os.tmpdir(), 'pristine-blocksuite-'), { recursive: true }).then(() =>
    path.join(os.tmpdir(), `pristine-blocksuite-${process.pid}-${Date.now()}`),
  );

  await rm(tempRoot, { recursive: true, force: true });

  runGit(['clone', '--filter=blob:none', '--sparse', '--no-checkout', config.repository, tempRoot], {
    retry: true,
    stdio: 'inherit',
  });
  runGit(['config', 'core.longpaths', 'true'], { cwd: tempRoot });
  runGit(['sparse-checkout', 'set', '--skip-checks', ...config.sparsePaths], { cwd: tempRoot });
  runGit(['checkout', config.resolvedCommit], { cwd: tempRoot, stdio: 'inherit' });

  return tempRoot;
}

function verifyLocalSource(localSourcePath, config) {
  if (!existsSync(path.join(localSourcePath, '.git'))) {
    throw new Error(`PRISTINE_BLOCKSUITE_SOURCE_DIR is not a git checkout: ${localSourcePath}`);
  }

  const commit = runGit(['rev-parse', 'HEAD'], { cwd: localSourcePath });

  if (commit !== config.resolvedCommit) {
    throw new Error(
      `PRISTINE_BLOCKSUITE_SOURCE_DIR points to ${commit}, expected ${config.resolvedCommit}.`,
    );
  }

  for (const relativePath of config.sparsePaths) {
    if (!existsSync(path.join(localSourcePath, relativePath))) {
      throw new Error(`PRISTINE_BLOCKSUITE_SOURCE_DIR is missing ${relativePath}`);
    }
  }
}

async function main() {
  const config = await readConfig();
  const vendorPath = getVendorPath(config);

  if (verifyOnly) {
    if (!(await isPrepared(vendorPath, config))) {
      throw new Error(
        `BlockSuite workspace is not prepared at ${path.relative(projectRoot, vendorPath)}. Run node scripts/prepare-blocksuite.mjs first.`,
      );
    }

    console.log(`BlockSuite ${config.tag} workspace verified at ${path.relative(projectRoot, vendorPath)}`);
    return;
  }

  if (await isPrepared(vendorPath, config)) {
    console.log(`BlockSuite ${config.tag} workspace already prepared at ${path.relative(projectRoot, vendorPath)}`);
    return;
  }

  const localSourcePath = getLocalSourcePath();
  const resolvedCommit = localSourcePath ? config.resolvedCommit : resolveTagCommit(config);

  if (resolvedCommit !== config.resolvedCommit) {
    throw new Error(
      `AFFiNE ${config.tag} resolved to ${resolvedCommit}, expected ${config.resolvedCommit}. Update config/blocksuite-upstream.json intentionally if this changes.`,
    );
  }

  let tempCheckout = null;

  try {
    if (localSourcePath) {
      verifyLocalSource(localSourcePath, config);
      await copySparseCheckout(localSourcePath, vendorPath, config);
    } else {
      tempCheckout = await cloneAffine(config);
      await copySparseCheckout(tempCheckout, vendorPath, config);
    }
    await writeMarker(vendorPath, config);
    console.log(`Prepared BlockSuite ${config.tag} workspace at ${path.relative(projectRoot, vendorPath)}`);
  } finally {
    if (tempCheckout) {
      await rm(tempCheckout, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});