# Manual verification — vscode-fsl

> Re-plan 2 (Task 10a/10b: in-webview live-render architecture). Walk requires
> a fresh F5 (reload / relaunch the Extension Development Host) after Task
> 10c's build — all items below reset to unchecked because the rendering
> architecture changed since the last walk.

- [ ] Traffic-light fence renders a live diagram (not a code block)
- [ ] Fence first shows escaped source, then the SVG appears on its own (host render → auto preview refresh) — no manual refresh
- [ ] Transitions re-render the live diagram via in-webview Graphviz (layout may legitimately shift on every transition — expected, not a bug); the CURRENT-STATE emphasis (background + text + border) is visibly attached to the new node every time, and the diagram stays visually coherent (no garbled/partial re-layout, no orphaned emphasis left on the old node)
- [ ] Clicking an action button transitions the machine; the current-state emphasis (background + text + border) moves to the new node
- [ ] width=300 fence is 300px wide
- [ ] ```js fence still renders as a normal highlighted code block
- [ ] Broken fence shows the FSL error box with the source visible beneath (appears even before any host SVG)
- [ ] Editing the .md re-renders the preview; machines re-hydrate (no double-mount, no dead panels)
- [ ] Switching VS Code light/dark theme restyles the IDE chrome without reload (host SVG stays its fixed light palette on its white ground — expected; see session item (e) for the LIVE diagram's theme behavior)
- [ ] Two fsl fences in one document run independently
- [ ] No CSP violation or uncaught error in the webview console — the live diagram's Graphviz now runs IN the webview via the Task 10a asm.js shim (CSP-legal: no eval/new Function, no WebAssembly); that shim is the only Graphviz path left in the preview bundle (Developer: Open Webview Developer Tools)

## Session additions (re-plan 2)

- [ ] (a) First-paint bridge: the fence's host-rendered static SVG is visible immediately; the live diagram swaps in within ~2 s (asm.js warmup) — there is NO blank flash between the two
- [ ] (b) Export / Stochastic toolbar actions are now backed by a real in-webview Graphviz engine (Task 10a) — record whether they actually WORK or go visibly-gracefully-inert; either outcome is acceptable, but an uncaught exception in the webview console is NOT
- [ ] (c) Error box on the broken fence is unchanged from the prior walk (still appears, still shows the escaped source beneath it)
- [ ] (d) Editing the document still re-hydrates correctly: the `vscode.markdown.updateContent` handshake fires and fences re-hydrate without a manual refresh
- [ ] (e) Switching the VS Code theme restyles the LIVE diagram too (the fsl-viz inside fsl-instance takes the new theme); the host-rendered first-paint static SVG stays theme-fixed light — expected, not a bug
