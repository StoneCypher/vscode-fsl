/**
 *  Builds both bundles: the extension-host bundle (Node/CJS, `vscode` external)
 *  and the preview-webview bundle (browser/IIFE, fully self-contained —
 *  includes jssm, lit, and @viz-js/viz so the webview needs no network).
 *
 *  Two side outputs support the surviving template stages:
 *    - `build/esbuild/*.meta.json` — esbuild metafiles the `viz_png` stage
 *      feeds to esbuild-visualizer to draw the bundle-composition graphs.
 *    - `dist/package.json` (`{ "type": "commonjs" }`) — scopes the CJS
 *      `dist/extension.js` so Node (and `attw`) read it as CommonJS. The root
 *      `package.json` carries no top-level `"type"` field at all (Node's own
 *      default is already CommonJS); the ESM marker for this project's
 *      `build_js` scripts lives in the separate `src/build_js/package.json`
 *      instead. This per-directory write is therefore belt-and-braces today
 *      rather than load-bearing — kept because it still documents intent for
 *      `attw`/Node consumers and keeps `dist/` correct if the root
 *      manifest's `"type"` ever changes.
 *
 *  Run: `node src/scripts/build.mjs`
 *
 *  @example
 *  // node src/scripts/build.mjs
 *  // writes dist/extension.js (+.map), dist/preview.js (+.map),
 *  //        dist/package.json, build/esbuild/{extension,preview}.meta.json
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdir, writeFile } from 'fs/promises';

const __filename  = fileURLToPath(import.meta.url);
const __dirname   = dirname(__filename);
const projectRoot = resolve(__dirname, '../../');

const abs = rel => resolve(projectRoot, rel);

await mkdir(abs('build/esbuild'), { recursive: true });
await mkdir(abs('dist'),          { recursive: true });

const extensionResult = await build({
  entryPoints : [abs('src/extension.ts')],
  bundle      : true,
  outfile     : abs('dist/extension.js'),
  format      : 'cjs',
  platform    : 'node',
  target      : 'node18',
  external    : ['vscode'],
  sourcemap   : true,
  metafile    : true,
});

const previewResult = await build({
  entryPoints : [abs('src/preview/preview.ts')],
  bundle      : true,
  outfile     : abs('dist/preview.js'),
  format      : 'iife',
  platform    : 'browser',
  target      : 'es2022',
  sourcemap   : true,
  metafile    : true,
  logOverride : { 'empty-import-meta': 'silent' },
  // The preview webview's markdown-preview CSP blocks WebAssembly, which
  // @viz-js/viz needs — but allows plain asm.js. Alias jssm's viz pipeline
  // (and jssm/dist/wc/widgets.js's static import of it) over to a shim
  // backed by viz.js@2's asm.js Graphviz build, which reimplements the
  // exact `instance().renderString(dot, opts)` surface jssm consumes.
  // Preview-bundle only — the extension-host bundle keeps the real,
  // faster WASM @viz-js/viz (no CSP there).
  //
  // jssm 5.162.x ships the configure({ viz }) engine-injection hook this
  // project originally requested (StoneCypher/fsl#1936) specifically to
  // remove this alias. Evaluated during the 5.162.32 adoption wave and
  // kept the alias anyway: configure() only stops jssm/viz's `get_viz()`
  // (dist/jssm_viz.mjs) from *executing* `import("@viz-js/viz")` at
  // runtime once a custom engine is injected — it does not change the fact
  // that the specifier is a literal string inside a dynamic `import()`,
  // which esbuild (like any bundler) statically resolves and bundles
  // regardless of whether the guarded branch ever runs. A bundled consumer
  // still needs to alias or external the module to keep the ~1.2 MB WASM
  // payload out of the output; configure() only helps un-bundled consumers
  // (plain ESM/Node) who have no static-analysis step to fool. See
  // notes/upstream-jssm.md for the upstream-facing writeup of this finding.
  alias: { '@viz-js/viz': abs('src/preview/viz_asm_shim.ts') },
});

await writeFile(abs('build/esbuild/extension.meta.json'), JSON.stringify(extensionResult.metafile), 'utf8');
await writeFile(abs('build/esbuild/preview.meta.json'),   JSON.stringify(previewResult.metafile),   'utf8');

// Belt-and-braces: mark dist/ as CommonJS explicitly for Node/attw. The root
// package.json has no top-level "type" field (Node already defaults to
// CommonJS) — see the module docblock above for where the real ESM marker
// (src/build_js/package.json) lives instead.
await writeFile(abs('dist/package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n', 'utf8');
