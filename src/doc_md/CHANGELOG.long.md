# Changelog

All notable changes to this project will be documented in this file.





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




&nbsp;

&nbsp;

## [Untagged] - Jul 10, 2026 8:22:15 PM

Commit [ebada762b64732bce43b12f4e4ae531046689700](https://github.com/StoneCypher/vscode-fsl/commit/ebada762b64732bce43b12f4e4ae531046689700)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * fix: surface unexpected wire_highlighting failures instead of swallowing them
  * Both catch blocks in wire_highlighting silently discarded every error,
whether it was the expected pre-connection transient (machine read
before fsl-instance finishes building its machine) or a genuine
regression (e.g. a future jssm API break in machine.on). Add a ready
latch that flips true after the first subscribe()/paint() pair, so
only failures after that point --- which can only happen on a real
fsl-machine-rebuilt event, never the initial race --- get a
console.warn breadcrumb naming the failed operation and the caught
error. The happy path is unchanged: no new throws, highlighting still
wires up silently on success.
  * Adds a StubFslInstance custom element + FakeMachine double to
hydrate.spec.ts to drive both the silent and warning paths through
real customElements.whenDefined behavior in jsdom (not a fake test:
jsdom 25 implements custom elements, so this branch is not structurally
inert).




&nbsp;

&nbsp;

## [Untagged] - Jul 10, 2026 7:20:21 AM

Commit [d90d9b4810adf4b6441599ddc6bd8257b180b21f](https://github.com/StoneCypher/vscode-fsl/commit/d90d9b4810adf4b6441599ddc6bd8257b180b21f)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * feat: hydrator mounts fsl-instance around the host-rendered SVG and drives state highlighting
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 4, 2026 9:24:02 PM

Commit [50353e51e8842692433ed0a7e067e310c318a66f](https://github.com/StoneCypher/vscode-fsl/commit/50353e51e8842692433ed0a7e067e310c318a66f)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * fix: re-enqueue render for a fence key evicted from the LRU cache
  * render_queue.ts tracked every attempted key in a single `attempted: Set`
that was never pruned, while the LruCache backing it evicts entries past
`capacity`. Once a key had been attempted, get_svg never re-enqueued it,
so after more than `capacity` distinct fences in one extension-host
session, revisiting an evicted diagram returned null forever.
  * Split `attempted` into two session-scoped sets:
- `pending` — keys with a render in flight; still dedupes concurrent
  misses for the same key down to one render call, and is cleared for a
  key the instant its render settles (success or failure).
- `failed` — keys whose render rejected; still suppressed from retry for
  the life of the queue, to avoid re-render churn on a broken fence while
  typing. Documented in the DocBlock, including that its growth is
  bounded by the count of distinct invalid sources seen this session.
  * Successful keys are now tracked only by cache membership (no separate
"succeeded" set), so cache eviction and the pending/failed sets can never
disagree: an evicted key is simply absent from all three, and the next
get_svg for it re-enqueues a fresh render exactly like a first-time miss.
  * Also added a defensive trailing .catch after the two-arg .then() so a
future throw in the fulfilled handler (e.g. from cache.set or on_ready)
can never surface as an unhandled rejection.
  * Extends src/tests/render_queue.spec.ts with:
- a regression test (capacity 1: render+cache A, evict A via B, then
  get_svg(A) again must re-render and eventually re-serve A's SVG) that
  fails against the pre-fix code, proving the defect before the fix;
- a test that a rejected key's render is never re-invoked on subsequent
  get_svg calls.
  * All pre-existing tests pass unmodified.
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 3, 2026 11:58:55 AM

Commit [d2478d456bb9134bf8c887357817e4d97f42c068](https://github.com/StoneCypher/vscode-fsl/commit/d2478d456bb9134bf8c887357817e4d97f42c068)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * fix: satisfy strict eslint rules in svg_cache (String() in template, undefined guard replaces as-assertion)
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 3, 2026 11:56:18 AM

Commit [ce9e90301a8f05810f2fee1faa6fa00f8a173ef3](https://github.com/StoneCypher/vscode-fsl/commit/ce9e90301a8f05810f2fee1faa6fa00f8a173ef3)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * fix: satisfy strict eslint rules in fence_plugin (String() in template, drop dead ??)




&nbsp;

&nbsp;

## [Untagged] - Jul 3, 2026 11:52:33 AM

Commit [06d4e2329a3e9fa3880de41b178e7f751c7f091f](https://github.com/StoneCypher/vscode-fsl/commit/06d4e2329a3e9fa3880de41b178e7f751c7f091f)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * feat: render queue + activate() wires host-side SVG cache and debounced preview refresh
  * - Add src/render_queue.ts: pure, injectable create_render_queue()
  (cache + dedupe + enqueue + on_ready), unit-tested with fake deps.
- Rewrite src/extension.ts: activate() builds the queue with
  render_fsl_svg + a debounced markdown.preview.refresh trigger that
  lazily import()s 'vscode' so the module still loads under vitest.
- Fix fence_plugin.ts's GetSvg @example to match svg_cache_key's real
  (source, width, height) signature instead of a stale (source, desc)
  call.
- Add @example to RenderQueueDeps and RenderQueue (exported interfaces
  the brief's sample code left undocumented), per project DocBlock
  policy.
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 3, 2026 11:42:42 AM

Commit [f3ec8302f42e325ff406c2912572101325897a43](https://github.com/StoneCypher/vscode-fsl/commit/f3ec8302f42e325ff406c2912572101325897a43)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * docs: add brief-mandated @example to exported type aliases
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 3, 2026 11:25:05 AM

Commit [fe79f8c724f55c3ed5661b28faf8d683cd313eb6](https://github.com/StoneCypher/vscode-fsl/commit/fe79f8c724f55c3ed5661b28faf8d683cd313eb6)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * fix: type-check src/tests via project-referenced tsconfig split
  * Test files under src/tests/ (*.spec.ts, *.stoch.ts) were excluded from
the root tsconfig.json so declaration emit stayed test-free, but that
meant no command type-checked them, and VS Code red-flagged every spec
with TS2307 because excluded files fell back to an inferred project
without bundler-style module resolution.
  * - Rename the former tsconfig.json (declarations-only, src non-test) to
  tsconfig.src.json, marked composite so it can be referenced.
- Add tsconfig.tests.json: extends tsconfig.src.json, noEmit/no
  declaration emit, includes all of src (tests included), and turns on
  allowJs/checkJs:false since a couple of relocated machinery specs
  (build_config.spec.ts, build_config.stoch.ts, postinstall.spec.ts)
  import plain .js modules from src/build_js/.
- Root tsconfig.json becomes a references-only solution file so VS
  Code routes every file to whichever sub-project actually includes
  it; it is a deliberate no-op under plain `tsc -p` (no --build
  semantics required — each sub-project still runs standalone).
- tsconfig.stryker.json now extends tsconfig.src.json directly.
- package.json: repoint `typescript` at tsconfig.src.json and add a
  new `typescript_tests` script.
- build_config_schema.js: add a mandatory `typescript_tests` feature
  in build stage 1 alongside `typescript` and `just_test_save`, so
  `npm run build` (any profile) gates on test type-checking too.
- Update build_config.spec.ts's stage-1 assertions for the new
  mandatory feature.
  * Verified: `npx tsc -p tsconfig.src.json`, `npx tsc -p
tsconfig.tests.json`, `npx vitest run`, and `npm run build --
profile=ci-lite` all pass clean; IDE diagnostics on every src/tests
spec file are empty.
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 3, 2026 10:53:27 AM

Commit [a4792b3ae466aab63a9e0c0251e75fdffa00d490](https://github.com/StoneCypher/vscode-fsl/commit/a4792b3ae466aab63a9e0c0251e75fdffa00d490)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * feat: host-side SVG render pipeline (cache + render) and fence plugin with injected SVG lookup
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 3, 2026 8:41:26 AM

Commit [089dad7348dc2f05db838b5d4e86e362a08f2042](https://github.com/StoneCypher/vscode-fsl/commit/089dad7348dc2f05db838b5d4e86e362a08f2042)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * docs(plan): re-plan Tasks 3-8 for host-side render fallback; hold info-panel out of 0.1.0
  * WASM is CSP-blocked in the Markdown preview (spike 28959a3). Rendering moves
host-side behind an LRU render cache with markdown.preview.refresh on
completion; the webview hydrates around the pre-rendered SVG and drives
highlighting via machine.on('transition'). fsl-viz cannot adopt external SVG
(verified against jssm 5.157.6) and is not mounted. info-panel held out by
user ruling until a jssm release ships it. Host SVGs are theme-fixed for
0.1.0.
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 2, 2026 3:16:31 PM

Commit [03ae156eefbe94fd2b611bfd90389f700ec4b1c5](https://github.com/StoneCypher/vscode-fsl/commit/03ae156eefbe94fd2b611bfd90389f700ec4b1c5)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * chore: rebuild artifacts with spike probe
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 2, 2026 3:16:08 PM

Commit [28959a3abf710d4f6327cf68b86da7a276b9a170](https://github.com/StoneCypher/vscode-fsl/commit/28959a3abf710d4f6327cf68b86da7a276b9a170)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * chore(spike): record WASM-under-preview-CSP result — BLOCKED, host-side-render fallback adopted
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 2, 2026 3:11:50 PM

Commit [5657845586754bb28202cb93892d870048f78be0](https://github.com/StoneCypher/vscode-fsl/commit/5657845586754bb28202cb93892d870048f78be0)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * fix: dev host opens samples/ to avoid same-folder collision with the main window
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 2, 2026 3:01:49 PM

Commit [0b81df9e459b33c1f9ebcc852f92bdde176791a6](https://github.com/StoneCypher/vscode-fsl/commit/0b81df9e459b33c1f9ebcc852f92bdde176791a6)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * fix: open the workspace folder in the Extension Development Host
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 2, 2026 12:39:39 PM

Commit [e76da9ef220fd6b7cf6c84a1f6df6b87ddd87c3b](https://github.com/StoneCypher/vscode-fsl/commit/e76da9ef220fd6b7cf6c84a1f6df6b87ddd87c3b)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * chore: add extensionHost launch config so F5 runs the extension




&nbsp;

&nbsp;

## [Untagged] - Jul 2, 2026 12:25:40 PM

Commit [8a3b21b0d1095778290cac5e7e7b4fc9c3cdce2f](https://github.com/StoneCypher/vscode-fsl/commit/8a3b21b0d1095778290cac5e7e7b4fc9c3cdce2f)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * chore(spike): WASM-under-preview-CSP probe + sample doc




&nbsp;

&nbsp;

## [Untagged] - Jul 2, 2026 12:14:34 PM

Commit [4d3f5b051e1b0ce60871c5149749794721290000](https://github.com/StoneCypher/vscode-fsl/commit/4d3f5b051e1b0ce60871c5149749794721290000)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * docs: add brief-mandated @example to extension stub DocBlocks




&nbsp;

&nbsp;

## [Untagged] - Jul 2, 2026 11:46:51 AM

Commit [973d8668e18618ed7e3296eaa53a46b89587d1fc](https://github.com/StoneCypher/vscode-fsl/commit/973d8668e18618ed7e3296eaa53a46b89587d1fc)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * chore: rebuild generated artifacts for the extension
  * Regenerated by a full `npm run build`: dist/{extension,preview}.js (+maps),
dist/extension.d.ts, dist/package.json; README.md and CHANGELOG* from the new
base_README and git history; bundle_{sunburst,treemap,network}.png (the old
bundle_flamegraph.png is dropped); refreshed coverage-stoch and
coverage-typedoc reports. Also folds in the template-instantiation dirt
(.claude/settings.local.json, typedoc-options.cjs).
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 2, 2026 11:46:22 AM

Commit [d265a7082d9d899ef5105e6f7054dbd29e8687c7](https://github.com/StoneCypher/vscode-fsl/commit/d265a7082d9d899ef5105e6f7054dbd29e8687c7)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * build: adapt surviving template pipeline to the extension
  * Keeps the template's stage orchestrator, docs, terser, attw, viz, madlibs,
changelog, cloc, eslint, stryker, playwright, and postinstall, retargeted:
- build_config_schema: rename mandatory `rollup` feature to `bundle`
  (node src/scripts/build.mjs); viz_png/terser now require `bundle`.
- clean: wipe/recreate build/ts + build/esbuild/visualizations, drop
  src/ts/generated_code and the rollup leaf.
- minify_bundles: terser dist/{extension,preview}.js in place.
- render_visualizations: draw sunburst/treemap/network from the esbuild
  metafiles via esbuild-visualizer, then Playwright-screenshot to PNG.
  (esbuild-visualizer's CLI offers no flamegraph, so the README grid is the
  three produced templates — no broken img.)
- verify_version_bump: compare package.json against the latest git tag
  (npm view crashes for a never-published VSIX); no tags -> pass.
- vitest unit/stoch/mutat: new src layout, passWithNoTests, thresholds
  relaxed while the entry points are stubs; relocated the surviving
  build_config + postinstall machinery tests into src/tests.
- eslint: node globals for build_js .cjs; ignore notes/ and .superpowers/.
- stryker/playwright/hosted_test/typedoc/site: point at the new layout.
- base_README rewritten for the extension using only substituted placeholders.
- ci.yml verify-version-bump: fetch-depth 0, drop the git-identity config.
- .gitignore: add .superpowers/ and *.vsix.
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 2, 2026 11:45:52 AM

Commit [55f3b5cf3d53de7eb83834121b5395a7af8fdb86](https://github.com/StoneCypher/vscode-fsl/commit/55f3b5cf3d53de7eb83834121b5395a7af8fdb86)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * feat: scaffold vscode-fsl extension (manifest, entry stubs, esbuild build)
  * Ports the VS Code extension scaffold from the scratch repo:
- package.json gains the extension manifest (engines.vscode ^1.90.0, main,
  activationEvents, contributes: markdown.markdownItPlugins +
  markdown.previewScripts), jssm/lit/@viz-js/viz deps, and extension devDeps
  (@types/vscode pinned exact 1.90.0, esbuild, vsce, markdown-it, jsdom).
  A types/exports surface keeps attw meaningful.
- src/extension.ts and src/preview/preview.ts entry stubs.
- src/scripts/build.mjs: two-bundle esbuild driver (host CJS + preview IIFE),
  also emitting metafiles for the viz stage and a dist/package.json commonjs
  marker so the CJS bundle resolves cleanly under the root type: module.
- tsconfig.json: strict typecheck emitting declarations only into build/ts.
- LICENSE (year 2026), .vscodeignore, and the plan/spec/handoff under notes/.
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 2, 2026 11:45:21 AM

Commit [f84b49dc4ccb9965d83eb0559cea9a3afc7ee324](https://github.com/StoneCypher/vscode-fsl/commit/f84b49dc4ccb9965d83eb0559cea9a3afc7ee324)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * chore: remove library sample code, rollup bundler, and stale library docs
  * The template shipped a sample library (src/ts, stub.ts) and a rollup
bundling config. The vscode-fsl port bundles with esbuild and has no
importable library surface, so these are removed. src/doc_md/tasklist.md
described the sample lib and goes too.
  * Claude-Session: https://claude.ai/code/session_01KngFgfysSsJ5LE2c4MWwmB




&nbsp;

&nbsp;

## [Untagged] - Jul 2, 2026 2:23:29 AM

Commit [18cba47e69c0a886deda310f74d8519b5f642560](https://github.com/StoneCypher/vscode-fsl/commit/18cba47e69c0a886deda310f74d8519b5f642560)

Author: `John Haugeland &lt;stonecypher@gmail.com>`

  * Initial commit