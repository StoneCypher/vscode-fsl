/**
 * Post-terser build guard: asserts the minified `dist/extension.js` still
 * exposes callable `activate`/`deactivate` exports to VS Code's CommonJS
 * loader, and that the root `package.json` carries no top-level `type`
 * field.
 *
 * This is the guard the type:module loader incident's own postmortem asked
 * for and never got (ledger lesson 3: "test the MINIFIED artifact"). What
 * happened: adding `"type": "module"` to the root manifest, combined with
 * esbuild's `0 &&` cjs-module-lexer export annotation and terser's dead-code
 * elimination, left VS Code's extension host unable to find `activate` on
 * the shipped bundle — the extension loaded without error and simply never
 * activated. Nothing in the pipeline failed loudly.
 *
 * This script is wired in as a mandatory stage-4 build feature (see
 * `verify_dist_entrypoints` in `build_config_schema.js`), which always runs
 * after stage 3's `terser` pass finishes, so it checks the artifact VS Code
 * will actually load rather than the pre-minified bundle.
 *
 * @example
 *   // Invoked by the `verify_dist_entrypoints` npm script, after `terser`:
 *   node src/build_js/verify_dist_entrypoints.js
 *   // Exits 0 silently on a healthy build; exits 1 with a specific message
 *   // if `activate`/`deactivate` are missing or non-callable, or if
 *   // package.json regains a top-level "type" field.
 *
 * @see src/scripts/build.mjs
 * @see src/build_js/minify_bundles.js
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

const require = createRequire(import.meta.url);
const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIST_EXTENSION = join(PROJECT_ROOT, 'dist', 'extension.js');
const ROOT_PACKAGE_JSON = join(PROJECT_ROOT, 'package.json');

/** Export names the VS Code extension host must find on `dist/extension.js`. */
export const REQUIRED_EXPORTS = ['activate', 'deactivate'];

/**
 * List which required export names are missing or not callable on a loaded
 * module. Pure and dependency-free, so it is unit-testable against plain
 * mock objects instead of a real `require()` of the built bundle.
 *
 * @param mod - the module namespace/exports object to check (e.g. the return value of `require('./dist/extension.js')`)
 * @param names - the export names that must be present and callable
 * @returns the subset of `names` missing or non-callable on `mod` (empty means healthy)
 *
 * @example
 *   missingCallableExports({ activate: () => {}, deactivate: () => {} }); // => []
 *
 * @example
 *   missingCallableExports({ activate: () => {} }); // => ['deactivate']
 */
export function missingCallableExports(mod, names = REQUIRED_EXPORTS) {
  return names.filter(name => typeof mod?.[name] !== 'function');
}

/**
 * Check whether a parsed package.json is free of a top-level `type` field.
 *
 * A `type` field on the ROOT manifest is the exact defect that triggered the
 * type:module loader incident (see this file's header). The ESM marker the
 * build scripts themselves need lives instead in `src/build_js/package.json`,
 * a directory-scoped override invisible to VS Code's extension host, and
 * `dist/package.json` separately scopes the shipped bundle to CommonJS.
 *
 * @param pkg - the parsed root package.json
 * @returns true when no top-level `type` field is present (the required state)
 *
 * @example
 *   manifestHasNoTypeField({ name: 'x' }); // => true
 *
 * @example
 *   manifestHasNoTypeField({ name: 'x', type: 'module' }); // => false
 */
export function manifestHasNoTypeField(pkg) {
  return !Object.prototype.hasOwnProperty.call(pkg, 'type');
}

/**
 * Entry point: load the minified extension bundle and the root manifest, and
 * throw with a precise, actionable message if either guard fails.
 *
 * Dependency-injected so tests can exercise both failure branches without
 * touching the filesystem or Node's `require` cache.
 *
 * @param loadDistExports - loads `dist/extension.js`'s exports object (defaults to a real `require`)
 * @param loadRootPackage - loads and parses the root package.json (defaults to a real read)
 * @throws {Error} if `dist/extension.js` is missing a required callable export, or the manifest carries a top-level `type` field
 *
 * @example
 *   main(() => ({ activate: () => {}, deactivate: () => {} }), () => ({ name: 'x' }));
 *   // resolves silently — both guards pass
 */
export function main(
  loadDistExports = () => require(DIST_EXTENSION),
  loadRootPackage  = () => JSON.parse(readFileSync(ROOT_PACKAGE_JSON, 'utf8')),
) {
  const mod = loadDistExports();
  const missing = missingCallableExports(mod);
  if (missing.length > 0) {
    throw new Error(
      `dist/extension.js is missing callable export(s): ${missing.join(', ')} — ` +
      `the VS Code extension host would silently fail to activate this build ` +
      `(this is the type:module loader incident's regression class).`
    );
  }

  const pkg = loadRootPackage();
  if (!manifestHasNoTypeField(pkg)) {
    throw new Error(
      `package.json must not declare a top-level "type" field (found "${String(pkg.type)}"); ` +
      `this is the exact defect that caused the type:module loader incident.`
    );
  }

  console.log('[verify_dist_entrypoints] dist/extension.js exposes activate/deactivate; package.json has no "type" field.');
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
