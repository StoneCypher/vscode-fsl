/**
 * Minifies the two esbuild output bundles (the extension host bundle and the
 * preview webview bundle) in parallel using terser's Node API.
 *
 * esbuild writes both bundles to dist/ already; this pass minifies them in
 * place. Each bundle is an independent input/output pair with its own source
 * map, so the work parallelizes cleanly via Promise.all.
 *
 * Reads dist/{extension,preview}.js (+ matching .map files) and writes the
 * minified code + a fresh source map back to the same paths. The output source
 * maps preserve the input maps' content so debuggers can trace minified code
 * back through esbuild all the way to the original TypeScript source.
 *
 * @example
 *   // Invoked by the `terser` npm script:
 *   node src/build_js/minify_bundles.js
 *   // Minifies dist/extension.js and dist/preview.js (+ source maps) in place
 */

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { minify } from 'terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const DIST = join(PROJECT_ROOT, 'dist');

const BUNDLES = [
  { name: 'extension.js' },
  { name: 'preview.js' },
];

/**
 * Minify one esbuild bundle in dist/ and write the result back in place.
 *
 * @param {{ name: string }} bundle - The bundle filename (relative to dist)
 * @returns {Promise<void>} Resolves once both output files are written
 *
 * @throws {Error} If terser reports an error or no code is produced
 */
async function minifyOne({ name }) {
  const inputPath = join(DIST, name);
  const inputMapPath = `${inputPath}.map`;
  const outputPath = join(DIST, name);
  const outputMapPath = `${outputPath}.map`;

  const [code, mapContent] = await Promise.all([
    readFile(inputPath, 'utf8'),
    readFile(inputMapPath, 'utf8'),
  ]);

  const result = await minify(code, {
    sourceMap: {
      content: mapContent,
      url: `${name}.map`,
    },
  });

  if (result.code == null) throw new Error(`terser produced no code for ${name}`);

  await Promise.all([
    writeFile(outputPath, result.code, 'utf8'),
    writeFile(outputMapPath, result.map, 'utf8'),
  ]);
}

async function main() {
  await Promise.all(BUNDLES.map(minifyOne));
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
