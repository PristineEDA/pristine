import materialIconThemeRaw from '../../../../../node_modules/material-icon-theme/dist/material-icons.json?raw';
import asciidocIcon from './icons/asciidoc.svg';
import awkIcon from './icons/awk.svg';
import badFileIcon from './icons/bad-file.svg';
import drawioIcon from './icons/drawio.svg';
import edaConfigIcon from './icons/eda-config.svg';
import edaFilelistIcon from './icons/eda-filelist.svg';
import fpgaConstraintIcon from './icons/fpga-constraint.svg';
import gtkwaveIcon from './icons/gtkwave.svg';
import linkerScriptIcon from './icons/linker-script.svg';
import logMessageIcon from './icons/log-message.svg';
import systemverilogHeaderIcon from './icons/systemverilog-header.svg';
import systemverilogIcon from './icons/systemverilog.svg';
import tempFileIcon from './icons/temp-file.svg';
import templateIcon from './icons/template.svg';
import timingConstraintIcon from './icons/timing-constraint.svg';
import toolScriptIcon from './icons/tool-script.svg';
import veribleIcon from './icons/verible.svg';
import verilogHeaderIcon from './icons/verilog-header.svg';
import verilogIcon from './icons/verilog.svg';
import yosysIcon from './icons/yosys.svg';
import { WORKSPACE_ROOT_PATH } from '../../../workspace/workspaceFiles';

interface MaterialIconTheme {
  iconDefinitions: Record<string, { iconPath: string }>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
  rootFolderNames: Record<string, string>;
  rootFolderNamesExpanded: Record<string, string>;
  file: string;
  folder: string;
  folderExpanded: string;
  rootFolder: string;
  rootFolderExpanded: string;
}

type WorkspaceIconKey = string;

interface WorkspaceResolvedIcon {
  key: WorkspaceIconKey;
  src: string;
}

interface WorkspaceFolderIconConfig {
  closed: WorkspaceIconKey;
  open: WorkspaceIconKey;
}

const MATERIAL_ICON_THEME = JSON.parse(materialIconThemeRaw) as MaterialIconTheme;

const MATERIAL_ICON_MODULES = import.meta.glob(
  '../../../../../node_modules/material-icon-theme/icons/*.svg',
  {
    eager: true,
    import: 'default',
  },
) as Record<string, string>;

const CUSTOM_FILE_ICON_SOURCES: Record<WorkspaceIconKey, string> = {
  asciidoc: asciidocIcon,
  awk: awkIcon,
  'bad-file': badFileIcon,
  drawio: drawioIcon,
  'eda-config': edaConfigIcon,
  'eda-filelist': edaFilelistIcon,
  'fpga-constraint': fpgaConstraintIcon,
  gtkwave: gtkwaveIcon,
  'linker-script': linkerScriptIcon,
  'log-message': logMessageIcon,
  systemverilog: systemverilogIcon,
  'systemverilog-header': systemverilogHeaderIcon,
  'temp-file': tempFileIcon,
  template: templateIcon,
  'timing-constraint': timingConstraintIcon,
  'tool-script': toolScriptIcon,
  verible: veribleIcon,
  verilog: verilogIcon,
  'verilog-header': verilogHeaderIcon,
  yosys: yosysIcon,
};

const CUSTOM_FILE_NAME_ICON_KEYS: Record<string, WorkspaceIconKey> = {
  'cleantests': 'tool-script',
  'disable_timing_checklist': 'eda-config',
  'gdbinit': 'eda-config',
  'runtests': 'tool-script',
  'xprop_config': 'eda-config',
};

const CUSTOM_FILE_NAME_PATTERNS: Array<[RegExp, WorkspaceIconKey]> = [
  [/^\.eslintrc(?:\..+)?$/i, 'eslint'],
  [/^eslint\.config\.[^.]+$/i, 'eslint'],
  [/^next\.config\.[^.]+$/i, 'next'],
  [/^playwright(?:-ct)?(?:\..+)?\.config\.[^.]+$/i, 'playwright'],
  [/^postcss\.config\.[^.]+$/i, 'postcss'],
  [/^tsconfig(?:\..+)?\.json$/i, 'tsconfig'],
  [/^vite\.config(?:\..+)?\.[^.]+$/i, 'vite'],
  [/^vitest(?:\..+)?\.config\.[^.]+$/i, 'vitest'],
  [/^vitest\.workspace\.[^.]+$/i, 'vitest'],
  [/^.+\.(?:test|spec|cy|e2e-spec)\.(?:cts|mts|ts)$/i, 'test-ts'],
  [/^.+\.(?:test|spec|cy)\.(?:jsx|tsx)$/i, 'test-jsx'],
  [/^.+\.(?:test|spec|cy|e2e-spec)\.(?:cjs|mjs|js)$/i, 'test-js'],
  [/^.+\.d\.(?:cts|mts|ts)$/i, 'typescript-def'],
];

const CUSTOM_FILE_EXTENSION_ICON_KEYS: Record<string, WorkspaceIconKey> = {
  'adoc': 'asciidoc',
  'awk': 'awk',
  'bad': 'bad-file',
  'cfg': 'eda-config',
  'config': 'eda-config',
  'constr': 'fpga-constraint',
  'drawio': 'drawio',
  'f': 'eda-filelist',
  'fl': 'eda-filelist',
  'gtkw': 'gtkwave',
  'ld': 'linker-script',
  'lds': 'linker-script',
  'lpf': 'fpga-constraint',
  'mak': 'makefile',
  'msg': 'log-message',
  'pcf': 'fpga-constraint',
  'pyc': 'python',
  'script': 'tool-script',
  'sdc': 'timing-constraint',
  'sv': 'systemverilog',
  'svh': 'systemverilog-header',
  'svs2333': 'temp-file',
  'tmpl': 'template',
  'v': 'verilog',
  'verible-format': 'verible',
  'verible-lint': 'verible',
  'vh': 'verilog-header',
  'xdc': 'fpga-constraint',
  'ys': 'yosys',
};

const CUSTOM_EXACT_FOLDER_ICON_KEYS: Record<string, WorkspaceFolderIconConfig> = {
  'api': { closed: 'folder-api', open: 'folder-api-open' },
  'app': { closed: 'folder-app', open: 'folder-app-open' },
  'assets': { closed: 'folder-resource', open: 'folder-resource-open' },
  'auth': { closed: 'folder-secure', open: 'folder-secure-open' },
  'build': { closed: 'folder-dist', open: 'folder-dist-open' },
  'components': { closed: 'folder-components', open: 'folder-components-open' },
  'config': { closed: 'folder-config', open: 'folder-config-open' },
  'configs': { closed: 'folder-config', open: 'folder-config-open' },
  'core': { closed: 'folder-core', open: 'folder-core-open' },
  'coverage': { closed: 'folder-coverage', open: 'folder-coverage-open' },
  'data': { closed: 'folder-database', open: 'folder-database-open' },
  'dist': { closed: 'folder-dist', open: 'folder-dist-open' },
  'docs': { closed: 'folder-docs', open: 'folder-docs-open' },
  'e2e': { closed: 'folder-test', open: 'folder-test-open' },
  'electron': { closed: 'folder-desktop', open: 'folder-desktop-open' },
  'generated': { closed: 'folder-generator', open: 'folder-generator-open' },
  'guidelines': { closed: 'folder-docs', open: 'folder-docs-open' },
  'hooks': { closed: 'folder-hook', open: 'folder-hook-open' },
  'lib': { closed: 'folder-lib', open: 'folder-lib-open' },
  'libs': { closed: 'folder-lib', open: 'folder-lib-open' },
  'node_modules': { closed: 'folder-node', open: 'folder-node-open' },
  'public': { closed: 'folder-public', open: 'folder-public-open' },
  'release': { closed: 'folder-dist', open: 'folder-dist-open' },
  'scripts': { closed: 'folder-scripts', open: 'folder-scripts-open' },
  'src': { closed: 'folder-src', open: 'folder-src-open' },
  'styles': { closed: 'folder-css', open: 'folder-css-open' },
  'test': { closed: 'folder-test', open: 'folder-test-open' },
  'tests': { closed: 'folder-test', open: 'folder-test-open' },
  'types': { closed: 'folder-typescript', open: 'folder-typescript-open' },
  'utils': { closed: 'folder-utils', open: 'folder-utils-open' },
};

const CUSTOM_FOLDER_TOKEN_ICON_KEYS: Record<string, WorkspaceFolderIconConfig> = {
  'api': { closed: 'folder-api', open: 'folder-api-open' },
  'app': { closed: 'folder-app', open: 'folder-app-open' },
  'asset': { closed: 'folder-resource', open: 'folder-resource-open' },
  'assets': { closed: 'folder-resource', open: 'folder-resource-open' },
  'auth': { closed: 'folder-secure', open: 'folder-secure-open' },
  'build': { closed: 'folder-dist', open: 'folder-dist-open' },
  'component': { closed: 'folder-components', open: 'folder-components-open' },
  'components': { closed: 'folder-components', open: 'folder-components-open' },
  'config': { closed: 'folder-config', open: 'folder-config-open' },
  'configs': { closed: 'folder-config', open: 'folder-config-open' },
  'core': { closed: 'folder-core', open: 'folder-core-open' },
  'coverage': { closed: 'folder-coverage', open: 'folder-coverage-open' },
  'data': { closed: 'folder-database', open: 'folder-database-open' },
  'dist': { closed: 'folder-dist', open: 'folder-dist-open' },
  'doc': { closed: 'folder-docs', open: 'folder-docs-open' },
  'docs': { closed: 'folder-docs', open: 'folder-docs-open' },
  'e2e': { closed: 'folder-test', open: 'folder-test-open' },
  'electron': { closed: 'folder-desktop', open: 'folder-desktop-open' },
  'generated': { closed: 'folder-generator', open: 'folder-generator-open' },
  'hook': { closed: 'folder-hook', open: 'folder-hook-open' },
  'hooks': { closed: 'folder-hook', open: 'folder-hook-open' },
  'lib': { closed: 'folder-lib', open: 'folder-lib-open' },
  'public': { closed: 'folder-public', open: 'folder-public-open' },
  'release': { closed: 'folder-dist', open: 'folder-dist-open' },
  'script': { closed: 'folder-scripts', open: 'folder-scripts-open' },
  'scripts': { closed: 'folder-scripts', open: 'folder-scripts-open' },
  'src': { closed: 'folder-src', open: 'folder-src-open' },
  'style': { closed: 'folder-css', open: 'folder-css-open' },
  'styles': { closed: 'folder-css', open: 'folder-css-open' },
  'test': { closed: 'folder-test', open: 'folder-test-open' },
  'tests': { closed: 'folder-test', open: 'folder-test-open' },
  'type': { closed: 'folder-typescript', open: 'folder-typescript-open' },
  'types': { closed: 'folder-typescript', open: 'folder-typescript-open' },
  'util': { closed: 'folder-utils', open: 'folder-utils-open' },
  'utils': { closed: 'folder-utils', open: 'folder-utils-open' },
};

function getBaseName(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
}

function normalizeMatchPath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function normalizeMatchName(value: string): string {
  return getBaseName(normalizeMatchPath(value)).toLowerCase();
}

function buildNormalizedIconKeyMap(
  map: Record<string, WorkspaceIconKey>,
): Record<string, WorkspaceIconKey> {
  return Object.fromEntries(
    Object.entries(map).map(([key, value]) => [key.toLowerCase(), value]),
  ) as Record<string, WorkspaceIconKey>;
}

function buildNormalizedFolderConfigMap(
  map: Record<string, WorkspaceFolderIconConfig>,
): Record<string, WorkspaceFolderIconConfig> {
  return Object.fromEntries(
    Object.entries(map).map(([key, value]) => [key.toLowerCase(), value]),
  ) as Record<string, WorkspaceFolderIconConfig>;
}

function buildThemeFolderConfigMap(
  closedMap: Record<string, WorkspaceIconKey>,
  openMap: Record<string, WorkspaceIconKey>,
): Record<string, WorkspaceFolderIconConfig> {
  const normalizedOpenMap = buildNormalizedIconKeyMap(openMap);

  return Object.fromEntries(
    Object.entries(closedMap).map(([key, closed]) => {
      const normalizedKey = key.toLowerCase();
      return [
        normalizedKey,
        {
          closed,
          open: normalizedOpenMap[normalizedKey] ?? `${closed}-open`,
        },
      ];
    }),
  ) as Record<string, WorkspaceFolderIconConfig>;
}

const MATERIAL_ICON_SOURCE_BY_FILE_NAME = Object.fromEntries(
  Object.entries(MATERIAL_ICON_MODULES).map(([modulePath, src]) => [getBaseName(modulePath), src]),
) as Record<string, string>;

const MATERIAL_THEME_ICON_SOURCES = Object.fromEntries(
  Object.entries(MATERIAL_ICON_THEME.iconDefinitions).flatMap(([iconKey, definition]) => {
    const src = MATERIAL_ICON_SOURCE_BY_FILE_NAME[getBaseName(definition.iconPath)];
    return src ? [[iconKey, src] as const] : [];
  }),
) as Record<WorkspaceIconKey, string>;

const ICON_SOURCES: Record<WorkspaceIconKey, string> = {
  ...MATERIAL_THEME_ICON_SOURCES,
  ...CUSTOM_FILE_ICON_SOURCES,
};

const FILE_NAME_ICON_KEYS = {
  ...buildNormalizedIconKeyMap(MATERIAL_ICON_THEME.fileNames),
  ...buildNormalizedIconKeyMap(CUSTOM_FILE_NAME_ICON_KEYS),
};

const FILE_EXTENSION_ICON_KEYS = {
  ...buildNormalizedIconKeyMap(MATERIAL_ICON_THEME.fileExtensions),
  ...buildNormalizedIconKeyMap(CUSTOM_FILE_EXTENSION_ICON_KEYS),
};

const FILE_EXTENSION_MATCHERS = Object.entries(FILE_EXTENSION_ICON_KEYS).sort(
  ([leftSuffix], [rightSuffix]) => rightSuffix.length - leftSuffix.length,
);

const EXACT_FOLDER_ICON_KEYS = {
  ...buildThemeFolderConfigMap(
    MATERIAL_ICON_THEME.folderNames,
    MATERIAL_ICON_THEME.folderNamesExpanded,
  ),
  ...buildNormalizedFolderConfigMap(CUSTOM_EXACT_FOLDER_ICON_KEYS),
};

const ROOT_FOLDER_ICON_KEYS = buildThemeFolderConfigMap(
  MATERIAL_ICON_THEME.rootFolderNames,
  MATERIAL_ICON_THEME.rootFolderNamesExpanded,
);

const FOLDER_TOKEN_ICON_KEYS = buildNormalizedFolderConfigMap(CUSTOM_FOLDER_TOKEN_ICON_KEYS);

const DEFAULT_FILE_ICON_KEY = MATERIAL_ICON_THEME.file;

const DEFAULT_FOLDER_ICON_CONFIG: WorkspaceFolderIconConfig = {
  closed: MATERIAL_ICON_THEME.folder,
  open: MATERIAL_ICON_THEME.folderExpanded,
};

const DEFAULT_ROOT_FOLDER_ICON_CONFIG: WorkspaceFolderIconConfig = {
  closed: MATERIAL_ICON_THEME.rootFolder,
  open: MATERIAL_ICON_THEME.rootFolderExpanded,
};

function resolveFolderKey(config: WorkspaceFolderIconConfig, isOpen: boolean): WorkspaceIconKey {
  return isOpen ? config.open : config.closed;
}

function getRequiredIconSource(key: WorkspaceIconKey, fallbackKey: WorkspaceIconKey): string {
  const source = ICON_SOURCES[key] ?? ICON_SOURCES[fallbackKey];

  if (source) {
    return source;
  }

  throw new Error(`Missing workspace icon source for ${key} and fallback ${fallbackKey}`);
}

function toResolvedFileIcon(key: WorkspaceIconKey): WorkspaceResolvedIcon {
  const resolvedKey = ICON_SOURCES[key] ? key : DEFAULT_FILE_ICON_KEY;
  const src = getRequiredIconSource(resolvedKey, DEFAULT_FILE_ICON_KEY);

  return {
    key: resolvedKey,
    src,
  };
}

function toResolvedFolderIcon(key: WorkspaceIconKey): WorkspaceResolvedIcon {
  const fallbackKey = DEFAULT_FOLDER_ICON_CONFIG.closed;
  const resolvedKey = ICON_SOURCES[key] ? key : fallbackKey;
  const src = getRequiredIconSource(resolvedKey, fallbackKey);

  return {
    key: resolvedKey,
    src,
  };
}

function findFileExtensionIconKey(normalizedName: string): WorkspaceIconKey | null {
  for (const [suffix, key] of FILE_EXTENSION_MATCHERS) {
    if (normalizedName === suffix || normalizedName.endsWith(`.${suffix}`)) {
      return key;
    }
  }

  return null;
}

function resolveFolderConfig(pathOrName: string, normalizedName: string): WorkspaceFolderIconConfig | null {
  const normalizedPath = normalizeMatchPath(pathOrName);
  const exactPathConfig = EXACT_FOLDER_ICON_KEYS[normalizedPath];

  if (exactPathConfig) {
    return exactPathConfig;
  }

  const exactNameConfig = EXACT_FOLDER_ICON_KEYS[normalizedName];
  if (exactNameConfig) {
    return exactNameConfig;
  }

  const tokens = normalizedName.split(/[^a-z0-9@]+/).filter(Boolean);

  for (const token of tokens) {
    const tokenConfig = FOLDER_TOKEN_ICON_KEYS[token];
    if (tokenConfig) {
      return tokenConfig;
    }
  }

  return null;
}

function buildIconClassName(className?: string): string {
  return ['pointer-events-none select-none object-contain shrink-0', className].filter(Boolean).join(' ');
}

export function resolveWorkspaceFileIcon(pathOrName: string): WorkspaceResolvedIcon {
  const normalizedPath = normalizeMatchPath(pathOrName);
  const normalizedName = normalizeMatchName(pathOrName);

  const exactPathKey = FILE_NAME_ICON_KEYS[normalizedPath];
  if (exactPathKey) {
    return toResolvedFileIcon(exactPathKey);
  }

  const exactNameKey = FILE_NAME_ICON_KEYS[normalizedName];
  if (exactNameKey) {
    return toResolvedFileIcon(exactNameKey);
  }

  for (const [pattern, key] of CUSTOM_FILE_NAME_PATTERNS) {
    if (pattern.test(normalizedName)) {
      return toResolvedFileIcon(key);
    }
  }

  const extensionMatchKey = findFileExtensionIconKey(normalizedName);
  if (extensionMatchKey) {
    return toResolvedFileIcon(extensionMatchKey);
  }

  return toResolvedFileIcon(DEFAULT_FILE_ICON_KEY);
}

export function resolveWorkspaceFolderIcon({
  name,
  path,
  isOpen,
  isRoot = false,
}: {
  name: string;
  path?: string;
  isOpen: boolean;
  isRoot?: boolean;
}): WorkspaceResolvedIcon {
  const pathOrName = path ?? name;
  const normalizedPath = normalizeMatchPath(pathOrName);

  if (isRoot || normalizedPath === WORKSPACE_ROOT_PATH) {
    const rootConfig = ROOT_FOLDER_ICON_KEYS[normalizedPath] ?? DEFAULT_ROOT_FOLDER_ICON_CONFIG;
    return toResolvedFolderIcon(resolveFolderKey(rootConfig, isOpen));
  }

  const normalizedName = normalizeMatchName(name);
  const folderConfig = resolveFolderConfig(pathOrName, normalizedName);
  if (folderConfig) {
    return toResolvedFolderIcon(resolveFolderKey(folderConfig, isOpen));
  }

  return toResolvedFolderIcon(resolveFolderKey(DEFAULT_FOLDER_ICON_CONFIG, isOpen));
}

export function WorkspaceFileIcon({
  name,
  path,
  className = 'h-4 w-4',
  testId,
}: {
  name: string;
  path?: string;
  className?: string;
  testId?: string;
}) {
  const icon = resolveWorkspaceFileIcon(path ?? name);

  return (
    <img
      alt=""
      aria-hidden="true"
      data-icon-key={icon.key}
      data-testid={testId}
      draggable={false}
      src={icon.src}
      className={buildIconClassName(className)}
    />
  );
}

export function WorkspaceFolderIcon({
  name,
  path,
  isOpen,
  isRoot = false,
  className = 'h-4 w-4',
  testId,
}: {
  name: string;
  path?: string;
  isOpen: boolean;
  isRoot?: boolean;
  className?: string;
  testId?: string;
}) {
  const icon = resolveWorkspaceFolderIcon({ name, path, isOpen, isRoot });

  return (
    <img
      alt=""
      aria-hidden="true"
      data-icon-key={icon.key}
      data-testid={testId}
      draggable={false}
      src={icon.src}
      className={buildIconClassName(className)}
    />
  );
}
