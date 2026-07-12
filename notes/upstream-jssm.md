# Upstream handoff — jssm issues found during vscode-fsl 0.1.0 integration

Written 2026-07-12 by the vscode-fsl session for the jssm-repo session. Items
ordered by urgency for vscode-fsl; #1 blocks a shipping fix.

## 1. fsl-viz: SVG overflows an auto-height host (BUG, fix requested)

**Repro:** give `<fsl-viz>` no explicit height but constrain it externally
(`max-height: 70vh` on the element). A graph taller than the cap renders at its
intrinsic size, visually overflowing the host and stacking behind subsequent
content.

**Mechanism:** `FslViz.styles` (dist/wc/viz.js ~L474-492) sizes
`.container { width:100%; height:100% }` and `.container svg { width:90%;
height:90% }`. With the host's computed height `auto` (the max-height-capped,
content-driven case), CSS percentage heights cannot resolve against the auto
parent, collapse to `auto`, and the SVG falls back to Graphviz's intrinsic
`width="..pt" height="..pt"` attributes. Nothing clips (hosts don't clip by
default), so the SVG escapes the box.

**Requirement:** an auto-height host under an external max-height must render
the SVG bounded and aspect-preserved (Graphviz SVGs carry viewBox +
default preserveAspectRatio, so max-constraints letterbox cleanly).

**Suggested fix shape (embedder-friendly):**
- `.container svg { max-width: 90%; max-height: 90%; }` alongside (or instead
  of) the percentage width/height, so intrinsic-size fallback stays bounded
  when percentages can't resolve; AND
- expose a pierce-the-shadow seam:
  `:host { max-height: var(--jssm-viz-max-height, none); }` plus
  `.container svg { max-height: min(90%, var(--jssm-viz-max-height, none)); }`
  or equivalent — a CSS custom property lets embedders (vscode-fsl sets
  `--jssm-viz-max-height: 70vh` on unsized fences) size the control without
  shadow-DOM surgery.

vscode-fsl is holding its "cap unsized diagrams" checklist item open pending a
jssm release with this; our side then reduces to setting the custom property.

## 2. fsl-viz highlightTrace: state-name vs slugged-title mismatch (BUG)

`highlightTrace` (dist/wc/viz.js ~L412-472) matches node `<title>` text against
caller-supplied state names, but dot generation slugs state names into node ids
(`slug_for`: lowercase, non-alphanumerics → `-`, in jssm_viz). Graphviz emits
the slug as the `<title>`, so `highlightTrace(['Red'])` never matches
`<title>red</title>`. Any machine whose state names aren't already slug-form
gets no highlighting. (vscode-fsl hit this in its own external highlighter and
fixed it by matching raw OR slugged; upstream likely wants the same.)

## 3. jssm/viz: configure({ viz }) engine-injection hook (FEATURE)

`get_viz()` (jssm_viz) hard-imports `@viz-js/viz` (WASM). VS Code's markdown
preview CSP blocks WASM but runs asm.js fine; vscode-fsl ships viz.js@2 (asm)
behind an esbuild alias of `@viz-js/viz` — it works, but a supported
`configure({ viz })` injection hook (mirroring the existing
`configure({ DOMParser })`) would remove the alias hack for every embedder in
a WASM-hostile environment.

## 4. FenceDescriptor: max-width= / max-height= tokens (FEATURE)

The fence grammar parses only `width=`/`height=`. John wants max-* sizing
semantics distinct from width/height (prompted by the same tall-diagram case
as #1: "several screen pages tall" for an unsized fence).

## 5. fsl-toolbar: content-based disabling needs a human override (DESIGN)

Controls (e.g. Stochastic) disable based on machine contents. John's ruling:
default-off by contents is smart, but the human must be able to turn a control
back on (the user may add stochastic weights next edit). Disabled-with-no-
override is the defect, esp. in editor-bearing embeddings.

## 7. 5.162.x: CJS type surface diverged from ESM (BUG, found 2026-07-12)

jssm.es5.d.cts (served to `require`-condition consumers) no longer exports
`parse_fence_info`, `fsl_fence_lang`, `FenceDescriptor`, `FenceDimension`
(and possibly more), while jssm.es6.d.ts still does and the CJS RUNTIME
(dist/jssm.es5.cjs) still exports them all. Types-only break: every CJS-typed
consumer fails typecheck on upgrade. Found by vscode-fsl attempting the
5.157.6 → 5.162.10 bump (reverted). Suggest a CI parity check between the two
declaration surfaces. Note the new `./fence` subpath exports a different,
render-oriented set (render_fence_gif, transform_markdown, …), so it is not a
relocation of the parse API.

## 6. fsl-info-panel: ship request (EXISTING)

jssm 5.157.x does not register fsl-info-panel; vscode-fsl 0.1.0 holds its slot
out entirely and will restore it when a release ships the component.
