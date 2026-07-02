/**
 *  Builds both bundles: the extension-host bundle (Node/CJS, `vscode` external)
 *  and the preview-webview bundle (browser/IIFE, fully self-contained —
 *  includes jssm, lit, and @viz-js/viz so the webview needs no network).
 *
 *  Two side outputs support the surviving template stages:
 *    - `build/esbuild/*.meta.json` — esbuild metafiles the `viz_png` stage
 *      feeds to esbuild-visualizer to draw the bundle-composition graphs.
 *    - `dist/package.json` (`{ "type": "commonjs" }`) — scopes the CJS
 *      `dist/extension.js` so Node (and `attw`) read it as CommonJS even though
 *      the repo root `package.json` is `"type": "module"` for the build_js ESM
 *      scripts. VS Code's extension host reads the root manifest for the
 *      contribution surface, so this per-directory marker is invisible to it.
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
});

await writeFile(abs('build/esbuild/extension.meta.json'), JSON.stringify(extensionResult.metafile), 'utf8');
await writeFile(abs('build/esbuild/preview.meta.json'),   JSON.stringify(previewResult.metafile),   'utf8');

// Mark dist/ as CommonJS so the CJS extension bundle resolves correctly under
// the repo's root "type": "module".
await writeFile(abs('dist/package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n', 'utf8');
