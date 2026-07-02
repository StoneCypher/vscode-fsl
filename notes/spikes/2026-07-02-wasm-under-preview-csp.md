# Spike: WASM under the Markdown-preview CSP — result

**Date:** 2026-07-02
**VS Code:** 1.127.0 (commit 4fe60c8b1cdac1c4c174f2fb180d0d758272d713, x64, Windows 11)
**Method:** F5 Extension Development Host → samples/demo.md → Markdown preview; probe from src/preview/preview.ts (commit 8a3b21b) read by the user.

## Observed probe text (verbatim)

> [vscode-fsl spike] WASM BLOCKED — WebAssembly.instantiate(): Compiling or instantiating WebAssembly module violates the following Content Security policy directive because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "script-src 'nonce-c10562ad-b4d2-4ffe-b0cc-b6e2f476c7de'".

## Decision: NO-GO for in-webview Graphviz

The Markdown preview's CSP is nonce-scoped `script-src` with no `wasm-unsafe-eval`, so `@viz-js/viz` can never instantiate in the webview. Per plan Task 2 Step 4, the fallback is adopted:

- The **initial SVG renders host-side** (the markdown-it plugin calls jssm/viz in the Node extension host, where WASM is unrestricted) and is inlined into the fence placeholder.
- The **preview bundle still mounts the full `<fsl-instance>` IDE (less editor)** around the pre-rendered SVG; live state changes use `<fsl-viz>`'s inline-style highlight API — no per-transition Graphviz re-render is needed.
- **Tasks 5 and 7 change shape** (and Task 3's placeholder gains the inlined SVG); execution stops for re-planning with the user before Task 3 begins.
