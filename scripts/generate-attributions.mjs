import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '..');
const temporaryRoot = path.resolve(workspaceRoot, '.tmp', 'generate-attributions');

const sourceFiles = [
  'src/app/about/attributions.ts',
  'src/app/editor/editorSettings.ts',
  'src/app/editor/themeCatalog.ts',
  'src/app/editor/themeSource.ts',
];

function rewriteRelativeImports(source) {
  return source.replace(/from\s+(['"])(\.[^'"]+)\1/g, (match, quote, specifier) => {
    if (specifier.endsWith('.mjs') || specifier.endsWith('.js')) {
      return match;
    }

    return `from ${quote}${specifier}.mjs${quote}`;
  });
}

function compileSourceFile(relativeSourcePath) {
  const sourcePath = path.resolve(workspaceRoot, relativeSourcePath);
  const targetPath = path.resolve(temporaryRoot, relativeSourcePath).replace(/\.ts$/, '.mjs');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false,
    },
    fileName: sourcePath,
  }).outputText;

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, rewriteRelativeImports(transpiled), 'utf8');
}

export async function generateAttributionsFile() {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });

  for (const sourceFile of sourceFiles) {
    compileSourceFile(sourceFile);
  }

  const attributionsModulePath = path.resolve(temporaryRoot, 'src/app/about/attributions.mjs');
  const attributionsModule = await import(pathToFileURL(attributionsModulePath).href);
  const markdown = attributionsModule.formatAttributionsMarkdown();

  fs.writeFileSync(path.resolve(workspaceRoot, 'ATTRIBUTIONS.md'), markdown, 'utf8');
  return markdown;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    await generateAttributionsFile();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
