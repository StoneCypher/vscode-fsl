# Changelog

All notable changes to this project will be documented in this file.

Changelogging the last 10 commits; Full changelog at [CHANGELOG.long.md](CHANGELOG.long.md)



&nbsp;

&nbsp;

Published tags:







&nbsp;

&nbsp;

## [Untagged] - Jul 11, 2026 4:38:52 PM

Commit [9e5a89de8aa57d73d85c7748a76434854eb1bc88](https://github.com/StoneCypher/vscode-fsl/commit/9e5a89de8aa57d73d85c7748a76434854eb1bc88)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * test: revise manual e2e checklist for re-plan 2 (live in-webview rendering)
  * Claude-Session: https://claude.ai/code/session_01HQRGPQosfZB7GoKR9QUHD8




&nbsp;

&nbsp;

## [Untagged] - Jul 11, 2026 4:11:54 PM

Commit [110073fbcf8b82b1cb962b41055eb07886a0e3ce](https://github.com/StoneCypher/vscode-fsl/commit/110073fbcf8b82b1cb962b41055eb07886a0e3ce)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * feat: hydrator mounts self-rendering fsl-instance — live in-webview graphviz replaces overlay highlighting
  * Task 10b: hydrate_fence now mounts an empty &lt;fsl-viz slot="viz"> inside
&lt;fsl-instance> instead of moving the host-rendered SVG into a
.fsl-static-viz slot div. jssm's fsl-viz self-binds to the instance's
machine in nested mode, so every transition is a genuine fresh Graphviz
render through Task 10a's in-webview asm.js shim rather than a
programmatic slug-matching overlay.
  * - preview.ts now imports jssm/wc/viz/define to actually register
  &lt;fsl-viz>; its STYLES retarget the theme-fixed-host-SVG rule from
  .fsl-static-viz to .fsl-fence-svg.
- First-paint bridge: the instance mounts display:none and the fence
  keeps its host-rendered .fsl-fence-svg visible until wire_first_paint_bridge
  observes a real &lt;svg> land in the live viz's shadow root (MutationObserver
  on Element.shadowRoot — fsl-viz has no render-succeeded event, only
  viz-error on failure), then swaps. Hides the ~1s asm.js warmup behind the
  already-visible static SVG instead of a blank pane. A failed live
  re-render simply never swaps, leaving the static SVG forever (never a
  silent blank).
- Deleted src/preview/highlight.ts and src/tests/highlight.spec.ts (the
  slug-matching overlay is superseded) along with wire_highlighting, the
  FslInstanceElement interface, and the TEMP-DEBUG status-line
  instrumentation that lived inside it.
- hydrate.spec.ts: replaced the wire_highlighting/stub-machine tests with
  a StubFslViz (real shadow root) and a first-paint-bridge describe block;
  hydrate_errors.spec.ts gained a regression test for the bridge's
  never-upgrades bail-out.
  * 93 -> 87 tests (12 -> 11 files): -10 deleted highlighting tests, +4 new
bridge tests. tsc/eslint clean. dist/preview.js (unminified): 10,887,584
bytes (+~2.21 MiB over Task 10a, from now actually bundling fsl-viz's Lit
component).
  * See .superpowers/sdd/task-10b-report.md for full verification output.
  * Claude-Session: https://claude.ai/code/session_01HQRGPQosfZB7GoKR9QUHD8




&nbsp;

&nbsp;

## [Untagged] - Jul 11, 2026 3:25:58 PM

Commit [8d748dd671bd49586588ba5aa4abad6241fca1ee](https://github.com/StoneCypher/vscode-fsl/commit/8d748dd671bd49586588ba5aa4abad6241fca1ee)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * feat: asm.js graphviz shim aliased over @viz-js/viz in the preview bundle (CSP-legal in-webview rendering)
  * New src/preview/viz_asm_shim.ts reimplements the exact @viz-js/viz surface
jssm's viz pipeline consumes (grepped node_modules/jssm/dist/jssm_viz.mjs:
`const mod = await import("@viz-js/viz"); viz_instance = await mod.instance()`,
then `viz_instance.renderString(dot, { format: "svg", ...opts })` is the
ONLY method ever called), backed by viz.js@2's asm.js Graphviz build instead
of WASM. VS Code's markdown-preview webview CSP blocks WebAssembly but
allows plain asm.js (user-verified spike, build/csp_probe_entry.mjs).
  * Adapter design:
- instance() resolves a VizAsmInstance wrapping `new Viz({ Module, render })`
  from viz.js + viz.js/full.render.js.
- renderString() awaits the wrapped call inside try/catch; on error it
  discards the corrupted viz.js@2 instance and constructs a fresh one before
  rethrowing, per viz.js@2's known post-error-instance-is-unusable quirk.
  * src/preview/viz_js.d.ts adds minimal ambient typings for viz.js (no bundled
types; TS7016 otherwise) — only the constructor/`renderString` shapes this
adapter touches, typed `unknown` rather than `any` for opaque Emscripten
internals.
  * src/scripts/build.mjs: alias '@viz-js/viz' -> the shim in the PREVIEW esbuild
config only; the extension-host bundle keeps the real WASM @viz-js/viz.
Bonus: this also redirects jssm/dist/wc/widgets.js's static viz import
(machine_to_svg_string/machine_to_dot), so the toolbar's Export/Stochastic
paths pick up a working in-webview renderer too.
  * package.json: viz.js moves devDependencies -> dependencies (it now ships
inside the shipped preview bundle); removed the temporary
"./build/csp_probe.js" previewScripts line now that the spike is concluded.
package-lock.json regenerated (--package-lock-only) to match.
  * TDD: src/tests/viz_asm_shim.spec.ts red-first (module-not-found) before
implementation; renders `digraph { a -> b; }` through instance().renderString
and asserts real &lt;svg> markup, plus an error-path test proving invalid dot
rejects and a subsequent valid render still succeeds.
  * Verification: vitest full suite 93/93 (91 prior + 2 new), tsc (src + tests)
clean, eslint src 0 problems, bundle stage confirms 0 '@viz-js/viz' hits and
3 'full.render' hits in dist/preview.js (8,568,367 bytes unminified) while
dist/extension.js keeps 3 real '@viz-js/viz' hits and 0 vizRenderFromString
hits.
  * Claude-Session: https://claude.ai/code/session_01HQRGPQosfZB7GoKR9QUHD8




&nbsp;

&nbsp;

## [Untagged] - Jul 11, 2026 3:25:58 PM

Commit [af5e094eb2a106d9bff6c431227ec55caef61e11](https://github.com/StoneCypher/vscode-fsl/commit/af5e094eb2a106d9bff6c431227ec55caef61e11)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * feat: asm.js graphviz shim aliased over @viz-js/viz in the preview bundle (CSP-legal in-webview rendering)
  * New src/preview/viz_asm_shim.ts reimplements the exact @viz-js/viz surface
jssm's viz pipeline consumes (grepped node_modules/jssm/dist/jssm_viz.mjs:
`const mod = await import("@viz-js/viz"); viz_instance = await mod.instance()`,
then `viz_instance.renderString(dot, { format: "svg", ...opts })` is the
ONLY method ever called), backed by viz.js@2's asm.js Graphviz build instead
of WASM. VS Code's markdown-preview webview CSP blocks WebAssembly but
allows plain asm.js (user-verified spike, build/csp_probe_entry.mjs).
  * Adapter design:
- instance() resolves a VizAsmInstance wrapping `new Viz({ Module, render })`
  from viz.js + viz.js/full.render.js.
- renderString() awaits the wrapped call inside try/catch; on error it
  discards the corrupted viz.js@2 instance and constructs a fresh one before
  rethrowing, per viz.js@2's known post-error-instance-is-unusable quirk.
  * src/preview/viz_js.d.ts adds minimal ambient typings for viz.js (no bundled
types; TS7016 otherwise) — only the constructor/`renderString` shapes this
adapter touches, typed `unknown` rather than `any` for opaque Emscripten
internals.
  * src/scripts/build.mjs: alias '@viz-js/viz' -> the shim in the PREVIEW esbuild
config only; the extension-host bundle keeps the real WASM @viz-js/viz.
Bonus: this also redirects jssm/dist/wc/widgets.js's static viz import
(machine_to_svg_string/machine_to_dot), so the toolbar's Export/Stochastic
paths pick up a working in-webview renderer too.
  * package.json: viz.js moves devDependencies -> dependencies (it now ships
inside the shipped preview bundle); removed the temporary
"./build/csp_probe.js" previewScripts line now that the spike is concluded.
package-lock.json regenerated (--package-lock-only) to match.
  * TDD: src/tests/viz_asm_shim.spec.ts red-first (module-not-found) before
implementation; renders `digraph { a -> b; }` through instance().renderString
and asserts real &lt;svg> markup, plus an error-path test proving invalid dot
rejects and a subsequent valid render still succeeds.
  * Verification: vitest full suite 93/93 (91 prior + 2 new), tsc (src + tests)
clean, eslint src 0 problems, bundle stage confirms 0 '@viz-js/viz' hits and
3 'full.render' hits in dist/preview.js (8,568,367 bytes unminified) while
dist/extension.js keeps 3 real '@viz-js/viz' hits and 0 vizRenderFromString
hits.




&nbsp;

&nbsp;

## [Untagged] - Jul 11, 2026 12:32:46 PM

Commit [29119c49fb14ee05ed0d668cfa54ed51b20221b8](https://github.com/StoneCypher/vscode-fsl/commit/29119c49fb14ee05ed0d668cfa54ed51b20221b8)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * fix: highlight matches jssm's slugged node ids (host SVG titles are lowercased slugs)
  * Claude-Session: https://claude.ai/code/session_01HQRGPQosfZB7GoKR9QUHD8




&nbsp;

&nbsp;

## [Untagged] - Jul 11, 2026 9:45:30 AM

Commit [eb810f4235c4554b24bb8f51a29b522111f5b6f1](https://github.com/StoneCypher/vscode-fsl/commit/eb810f4235c4554b24bb8f51a29b522111f5b6f1)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * fix: warn on host-side render and preview-refresh failures instead of swallowing them; strip debug instrumentation
  * Claude-Session: https://claude.ai/code/session_01HQRGPQosfZB7GoKR9QUHD8




&nbsp;

&nbsp;

## [Untagged] - Jul 11, 2026 9:03:40 AM

Commit [ac4cda12f8717f25c0d7fd6666dacee6224d6f94](https://github.com/StoneCypher/vscode-fsl/commit/ac4cda12f8717f25c0d7fd6666dacee6224d6f94)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * fix: drop manifest "type":"module" so VS Code requires the CJS bundle (terser strips the import() export annotation)
  * VS Code's extension loader treats an extension as ESM when the manifest has "type": "module" and loads dist/extension.js via import(); our bundle is esbuild CJS output whose named exports are only visible to an ESM importer through esbuild's `0 && (module.exports = {...})` cjs-module-lexer annotation, which the terser minification stage deletes as dead code. That silently hid the activate export from modern VS Code, so the markdown-it plugin never installed. Removing "type": "module" from the manifest routes VS Code down the plain require() path instead, which needs no such annotation; src/build_js's ESM-syntax scripts get their own nested package.json, and eslint.config.js / commitlint.config.js (both ESM-syntax) are renamed to .mjs so their tooling still auto-discovers them.
  * Claude-Session: https://claude.ai/code/session_01HQRGPQosfZB7GoKR9QUHD8




&nbsp;

&nbsp;

## [Untagged] - Jul 10, 2026 9:54:33 PM

Commit [91b06a9c348aae92f3de0d5c385fa55a9bfe6353](https://github.com/StoneCypher/vscode-fsl/commit/91b06a9c348aae92f3de0d5c385fa55a9bfe6353)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * fix: satisfy strict eslint in root config files (full-profile build gate)
  * Four root *.config.ts files (playwright.config.ts, vitest.config.ts,
vitest-stoch.config.ts, vitest-mutat.config.ts) matched eslint.config.js's
allowDefaultProject: ["*.config.ts"] fallback and were type-checked
against typescript-eslint's synthesized single-file default project,
whose compiler options come from the root tsconfig.json (a references-
only solution file with no compilerOptions, hence no strictNullChecks).
Several strictTypeChecked/stylisticTypeChecked rules refuse to run their
real analysis and report a structural error unconditionally without
strictNullChecks, and playwright.config.ts additionally got one false-
positive no-unnecessary-condition finding from the same root cause.
  * Opted the four affected rules in via their own documented
allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing escape hatch
(inline per-file eslint directive comments), and added one targeted
eslint-disable-next-line with justification for the remaining false
positive in playwright.config.ts. No config semantics changed: same
test dirs, same coverage settings, same browser matrix, same mutation
settings — verified via diff review.
  * Claude-Session: https://claude.ai/code/session_01HQRGPQosfZB7GoKR9QUHD8




&nbsp;

&nbsp;

## [Untagged] - Jul 10, 2026 8:59:33 PM

Commit [c57b54d92edc786bc0707b0031e55f86601b6d9d](https://github.com/StoneCypher/vscode-fsl/commit/c57b54d92edc786bc0707b0031e55f86601b6d9d)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * feat: preview entry — defines, hydration lifecycle, VS Code theming
  * Task 7: src/preview/preview.ts replaces the Task-2 WASM-CSP-probe stub
with the real webview bootstrap: registers jssm/wc/instance/define and
jssm/wc/widgets/define, injects error-box/static-viz/fence CSS once,
runs hydrate_all + theme sync on load, and re-runs both on
vscode.markdown.updateContent (the render->refresh->hydrate handshake
for late-arriving host SVGs). New src/preview/theme.ts exports
theme_for_body_classes(classList), mapping VS Code's vscode-* body
classes to a concrete fsl-instance theme variant, applied on load and
kept live via a MutationObserver on document.body's class attribute.
  * Claude-Session: https://claude.ai/code/session_01HQRGPQosfZB7GoKR9QUHD8




&nbsp;

&nbsp;

## [Untagged] - Jul 10, 2026 8:36:38 PM

Commit [5119fc757666ecfccd230d158b0824116b5856b5](https://github.com/StoneCypher/vscode-fsl/commit/5119fc757666ecfccd230d158b0824116b5856b5)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * feat: visible error box for invalid FSL; source stays readable
  * Task 6: hydrate_fence now validates FSL source via jssm's sm tagged
template ahead of the .fsl-fence-svg pending gate. Invalid source gets
a .fsl-error-box (title + message) prepended, the escaped source stays
visible beneath it, no fsl-instance is mounted, and the fence is marked
hydrated so it is not re-validated on every preview refresh. Valid
fences are unaffected (still gated on the host SVG as before).
  * Claude-Session: https://claude.ai/code/session_01HQRGPQosfZB7GoKR9QUHD8