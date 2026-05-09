import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const noticeDocumentTitle = 'Bundled Third-Party License and Notice Texts';
const noticeDocumentDescription =
  'Pristine bundles third-party open-source software and packaged resources. This NOTICE file preserves the full bundled license and notice text for the third-party components listed in ATTRIBUTIONS.md. Packaged desktop builds place LICENSE, ATTRIBUTIONS.md, and NOTICE under resources/licenses.';

const noticeFamilies = [
  {
    id: 'apache-2.0',
    title: 'Apache License 2.0',
    sourcePath: 'licenses/texts/Apache-2.0.txt',
    note: 'This section preserves the Apache License 2.0 text for the bundled components listed above.',
  },
  {
    id: 'mit',
    title: 'MIT License',
    sourcePath: 'licenses/texts/MIT.txt',
    note: 'This section preserves the shared MIT license terms. Project-specific authors and source URLs remain listed in ATTRIBUTIONS.md.',
  },
  {
    id: 'isc',
    title: 'ISC License',
    sourcePath: 'licenses/texts/ISC.txt',
    note: 'This section preserves the shared ISC license terms. Project-specific authors and source URLs remain listed in ATTRIBUTIONS.md.',
  },
  {
    id: 'bsd-2-clause',
    title: 'BSD 2-Clause License',
    sourcePath: 'licenses/texts/BSD-2-Clause.txt',
    note: 'This section preserves the shared BSD 2-Clause license terms. Project-specific authors and source URLs remain listed in ATTRIBUTIONS.md.',
  },
  {
    id: 'cc0-1.0',
    title: 'Creative Commons Zero v1.0 Universal',
    sourcePath: 'licenses/texts/CC0-1.0.txt',
    note: 'This section preserves the full CC0 1.0 legal code for the bundled components listed above.',
  },
  {
    id: 'ofl-1.1',
    title: 'SIL Open Font License 1.1',
    sourcePath: 'licenses/texts/OFL-1.1.txt',
    note: 'This section preserves the full OFL 1.1 text for the bundled font assets listed above.',
  },
  {
    id: 'ufl-1.0',
    title: 'Ubuntu Font Licence 1.0',
    sourcePath: 'licenses/texts/UFL-1.0.txt',
    note: 'This section preserves the full Ubuntu Font Licence 1.0 text for the bundled font assets listed above.',
  },
  {
    id: 'bitstream-vera-arev-public-domain-notices',
    title: 'Bitstream Vera / Arev / Public Domain Notices',
    sourcePath: 'licenses/texts/Bitstream-Vera-Arev-Public-Domain.txt',
    note: 'This section preserves the bundled Bitstream Vera, Arev, and related public-domain font notices.',
  },
];

const licenseLabelToFamilyIds = new Map([
  ['Apache-2.0', ['apache-2.0']],
  ['MIT', ['mit']],
  ['ISC', ['isc']],
  ['BSD-2-Clause', ['bsd-2-clause']],
  ['CC0-1.0', ['cc0-1.0']],
  ['OFL-1.1', ['ofl-1.1']],
  ['UFL-1.0', ['ufl-1.0']],
  ['MIT / OFL-1.1', ['mit', 'ofl-1.1']],
  ['MIT / Bitstream Vera', ['mit', 'bitstream-vera-arev-public-domain-notices']],
  ['Bitstream Vera / Arev / Public Domain Notices', ['bitstream-vera-arev-public-domain-notices']],
]);

const noticeFamiliesById = new Map(noticeFamilies.map((family) => [family.id, family]));
const noticeLicensePattern = new RegExp(
  `^(.+?)（(.+?)）(.+?) (${[...licenseLabelToFamilyIds.keys()]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join('|')})$`,
);

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultWorkspaceRoot = path.resolve(scriptDirectory, '..');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, '\n');
}

function readWorkspaceTextFile(workspaceRoot, relativePath) {
  return normalizeLineEndings(fs.readFileSync(path.resolve(workspaceRoot, relativePath), 'utf8')).trimEnd();
}

function parseAttributionLine(line, sectionTitle) {
  const match = line.match(noticeLicensePattern);

  if (!match) {
    throw new Error(`Unable to parse attribution line in section "${sectionTitle}": ${line}`);
  }

  return {
    name: match[1],
    url: match[2],
    author: match[3],
    license: match[4],
    sectionTitle,
  };
}

export function parseAttributionsMarkdown(markdown) {
  const lines = normalizeLineEndings(markdown).split('\n');
  const entries = [];
  let activeSectionTitle = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      activeSectionTitle = line.slice(3).trim();
      continue;
    }

    if (!line || line.startsWith('# ') || !activeSectionTitle) {
      continue;
    }

    if (!line.includes('（')) {
      continue;
    }

    entries.push(parseAttributionLine(line, activeSectionTitle));
  }

  return entries;
}

function buildNoticeFamilyEntries(attributionEntries) {
  const entriesByFamilyId = new Map(noticeFamilies.map((family) => [family.id, []]));

  for (const attributionEntry of attributionEntries) {
    const familyIds = licenseLabelToFamilyIds.get(attributionEntry.license);

    if (!familyIds) {
      throw new Error(`Missing notice-family mapping for license label "${attributionEntry.license}".`);
    }

    for (const familyId of familyIds) {
      entriesByFamilyId.get(familyId)?.push(attributionEntry);
    }
  }

  return noticeFamilies
    .map((family) => ({
      family,
      items: entriesByFamilyId.get(family.id) ?? [],
    }))
    .filter((entry) => entry.items.length > 0);
}

function formatCoveredItem(item) {
  return `- ${item.name} (${item.sectionTitle}; declared as ${item.license})`;
}

export function buildNoticeMarkdown({ workspaceRoot = defaultWorkspaceRoot, attributionsMarkdown } = {}) {
  const attributionText = attributionsMarkdown ?? readWorkspaceTextFile(workspaceRoot, 'ATTRIBUTIONS.md');
  const attributionEntries = parseAttributionsMarkdown(attributionText);
  const noticeFamilyEntries = buildNoticeFamilyEntries(attributionEntries).map((entry) => ({
    ...entry,
    text: readWorkspaceTextFile(workspaceRoot, entry.family.sourcePath),
  }));

  return [
    `# ${noticeDocumentTitle}`,
    '',
    noticeDocumentDescription,
    '',
    'ATTRIBUTIONS.md remains the readable per-project inventory, including project names, source URLs, authors, and declared licenses. This NOTICE file groups those bundled components by license and notice family and preserves the corresponding full text.',
    '',
    '## Included Notice Files',
    '',
    '- LICENSE',
    '- ATTRIBUTIONS.md',
    '- NOTICE',
    '',
    '## License and Notice Families',
    '',
    ...noticeFamilyEntries.map((entry) => `- ${entry.family.title}`),
    '',
    '## Full Text Notices',
    '',
    ...noticeFamilyEntries.flatMap((entry, index) => {
      const lines = [
        `### ${entry.family.title}`,
        '',
        'Covered components:',
        ...entry.items.map(formatCoveredItem),
        '',
        entry.family.note,
        '',
        '```text',
        entry.text,
        '```',
      ];

      if (index < noticeFamilyEntries.length - 1) {
        lines.push('');
      }

      return lines;
    }),
    '',
  ].join('\n');
}

export function generateNoticeFile({ workspaceRoot = defaultWorkspaceRoot } = {}) {
  const noticePath = path.resolve(workspaceRoot, 'NOTICE');
  const noticeMarkdown = buildNoticeMarkdown({ workspaceRoot });

  fs.writeFileSync(noticePath, noticeMarkdown, 'utf8');
  return noticeMarkdown;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    generateNoticeFile();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}