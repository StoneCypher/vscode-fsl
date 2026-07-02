/**
 * Builds the bundle-composition visualizations for the two esbuild bundles and
 * screenshots each to a PNG using a single shared Playwright browser.
 *
 * The template's rollup pipeline produced its four visualizer HTML files as a
 * side effect of bundling; esbuild has no such plugin, so this script does both
 * halves itself:
 *
 *   1. For each supported template, run the `esbuild-visualizer` CLI over the
 *      extension + preview metafiles (emitted by src/scripts/build.mjs) to
 *      write build/esbuild/visualizations/bundle_<template>.html.
 *   2. Launch Chromium once, open each HTML on the shared browser, hide the
 *      sidebar, and screenshot to bundle_<template>.png alongside the HTML.
 *
 * Only the three graphical templates the `esbuild-visualizer` 0.7 CLI exposes
 * are produced: sunburst, treemap, network. (The rollup pipeline also drew a
 * flamegraph; esbuild-visualizer's CLI does not offer that template, so the
 * README image grid was reduced to the three produced here — no broken img.)
 *
 * @example
 *   // Invoked by the `viz_png` npm script:
 *   node src/build_js/render_visualizations.js
 *   // Writes build/esbuild/visualizations/bundle_{sunburst,treemap,network}.{html,png}
 */

import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..', '..');
const ESBUILD_DIR  = join(PROJECT_ROOT, 'build', 'esbuild');
const VIZ_DIR      = join(ESBUILD_DIR, 'visualizations');
const METAFILES    = [
  join(ESBUILD_DIR, 'extension.meta.json'),
  join(ESBUILD_DIR, 'preview.meta.json'),
];

const CLI = require.resolve('esbuild-visualizer/dist/bin/cli.js');

const WIDTH = 768;
const HEIGHT = 480;
const VISUALIZATIONS = ['sunburst', 'treemap', 'network'];

/**
 * Generate one visualization HTML from the esbuild metafiles.
 *
 * @param {string} name - The template name (e.g., "sunburst")
 * @returns {void}
 */
function generateOne(name) {
  const out = join(VIZ_DIR, `bundle_${name}.html`);
  execFileSync(process.execPath, [
    CLI,
    '--template', name,
    '--filename', out,
    '--title', `vscode-fsl bundle (${name})`,
    '--metadata', ...METAFILES,
  ], { stdio: 'inherit' });
}

/**
 * Render one visualization on a fresh page from a shared browser.
 *
 * @param {import('playwright').Browser} browser - The shared Chromium instance
 * @param {string} name - The visualization name (e.g., "sunburst")
 * @returns {Promise<void>} Resolves once the PNG has been written
 */
async function renderOne(browser, name) {
  const url = pathToFileURL(join(VIZ_DIR, `bundle_${name}.html`)).href;
  const out = join(VIZ_DIR, `bundle_${name}.png`);
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      const style = document.querySelector('style');
      if (style) {
        style.textContent = style.textContent + '\n.sidebar { display: none !important; }';
      }
    });
    await page.screenshot({ path: out, fullPage: true });
    console.log(`Saved ${out}`);
  } finally {
    await page.close();
  }
}

async function main() {
  for (const name of VISUALIZATIONS) {
    generateOne(name);
  }

  const browser = await chromium.launch();
  try {
    await Promise.all(VISUALIZATIONS.map(name => renderOne(browser, name)));
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
