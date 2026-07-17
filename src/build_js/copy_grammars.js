/**
 * Build step: copies jssm's published TextMate grammar for `.fsl` files into
 * this extension's packaged tree, so `contributes.grammars` in `package.json`
 * has a real file to point at and VS Code can syntax-color `.fsl` files.
 *
 * jssm ships its grammar behind the `"./grammar"` subpath export in its own
 * package.json (currently resolving to `dist/grammars/fsl.tmLanguage.json`),
 * not at a path this extension should hardcode — jssm only promises the
 * subpath contract, not any particular file layout beneath it. Resolving via
 * `require.resolve('jssm/grammar')` keeps this script correct across jssm
 * releases that relocate the file.
 *
 * `./syntaxes/` is also home to a hand-authored markdown-fence injection
 * grammar added in a later change; this script only ever reads/writes its
 * own `fsl.tmLanguage.json` within that directory.
 *
 * @example
 *   // Invoked by the `copy_grammars` npm script, in build stage 1:
 *   node src/build_js/copy_grammars.js
 *   // Copies jssm's published grammar to ./syntaxes/fsl.tmLanguage.json
 *
 * @see package.json (contributes.grammars registers the copied file)
 * @see src/build_js/build_config_schema.js (mandatory stage-1 feature entry)
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Where the copied grammar lands, relative to the project root. */
export const DEST_PATH = join(PROJECT_ROOT, 'syntaxes', 'fsl.tmLanguage.json');

/**
 * The filesystem operations `copyGrammarFile`/`main` need, narrowed to the
 * one call shape each is actually used with here. Declaring this instead of
 * letting each parameter's type be inferred straight from `fs`'s (heavily
 * overloaded) exports keeps the injected-mock shape simple for tests — a
 * plain `vi.fn()` satisfies these signatures, where the full `fs` overload
 * set would not.
 *
 * @typedef {{
 *   readFileSync: (path: string, encoding: BufferEncoding) => string,
 *   mkdirSync: (path: string, options: { recursive: boolean }) => (string | undefined),
 *   writeFileSync: (path: string, data: string, encoding: BufferEncoding) => void,
 * }} GrammarIO
 */

/** Real filesystem operations, grouped for dependency injection.
 * @type {GrammarIO} */
const REAL_IO = { readFileSync, mkdirSync, writeFileSync };

/**
 * Resolve the absolute path to jssm's published TextMate grammar file.
 *
 * Delegates to an injected resolver instead of hardcoding
 * `node_modules/jssm/dist/grammars/...` directly, so this script keeps
 * working if a future jssm release moves the file — only the `"./grammar"`
 * subpath export is a stable contract.
 *
 * @param {(specifier: string) => string} [resolveFn] - resolves a module specifier to an absolute path (defaults to `require.resolve`)
 * @returns the absolute path to jssm's `fsl.tmLanguage.json`
 * @throws {Error} if `resolveFn` cannot resolve `'jssm/grammar'` (e.g. jssm is not installed, or a jssm release drops the subpath export)
 *
 * @example
 *   resolveGrammarSource(spec => `/mock/${spec}`); // => '/mock/jssm/grammar'
 */
export function resolveGrammarSource(resolveFn = require.resolve) {
  return resolveFn('jssm/grammar');
}

/**
 * Copy a grammar file's text from `sourcePath` to `destPath`, creating the
 * destination's parent directory first.
 *
 * @param {string} sourcePath - absolute path to the grammar JSON to read
 * @param {string} destPath - absolute path to write the grammar JSON to
 * @param {GrammarIO} [io] - injected filesystem operations (defaults to real `fs` calls)
 * @returns the grammar file's text, exactly as written to `destPath`
 * @throws {Error} if `sourcePath` cannot be read, or `destPath`'s directory cannot be created/written
 *
 * @example
 *   copyGrammarFile('/src/fsl.tmLanguage.json', '/dest/fsl.tmLanguage.json', {
 *     readFileSync: () => '{"scopeName":"source.fsl"}',
 *     mkdirSync: () => undefined,
 *     writeFileSync: () => undefined,
 *   }); // => '{"scopeName":"source.fsl"}'
 */
export function copyGrammarFile(sourcePath, destPath, io = REAL_IO) {
  const text = io.readFileSync(sourcePath, 'utf8');
  io.mkdirSync(dirname(destPath), { recursive: true });
  io.writeFileSync(destPath, text, 'utf8');
  return text;
}

/**
 * Entry point: resolve jssm's published grammar and copy it into
 * `./syntaxes/fsl.tmLanguage.json`.
 *
 * Dependency-injected so tests can exercise the wiring — resolve-then-copy,
 * in that order, with the right paths — without touching the real
 * filesystem or `require.resolve`.
 *
 * @param {(specifier: string) => string} [resolve] - resolves `'jssm/grammar'` to an absolute path (defaults to `require.resolve`)
 * @param {GrammarIO} [io] - injected filesystem operations (defaults to real `fs` calls)
 * @returns the grammar file's text, as copied to the destination
 * @throws {Error} if jssm's grammar cannot be resolved, or the file cannot be read/written
 *
 * @example
 *   main(() => '/mock/fsl.tmLanguage.json', {
 *     readFileSync: () => '{}',
 *     mkdirSync: () => undefined,
 *     writeFileSync: () => undefined,
 *   }); // => '{}'
 */
export function main(resolve = require.resolve, io = REAL_IO) {
  const sourcePath = resolveGrammarSource(resolve);
  const text = copyGrammarFile(sourcePath, DEST_PATH, io);
  console.log(`[copy_grammars] copied jssm's TextMate grammar to ${DEST_PATH}`);
  return text;
}

// Run only when invoked directly, never when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
