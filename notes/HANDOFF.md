# HANDOFF — vscode-fsl extension build

**Written:** 2026-07-02, by the jssm-session Fable that authored the plan.
**You are:** a fresh session picking up execution of a VS Code extension build, working in the template-derived `vscode-fsl` repo (a sibling of this scratch directory).
**Read next:** `notes/superpowers/plans/2026-07-02-vscode-fsl-extension.md` (in this scratch repo — port it with you). It is the complete, zero-context implementation plan; this handoff only carries what the plan cannot: state, port instructions, and decisions made since it was written.

## Mission in one paragraph

Render ` ```fsl ` / ` ```jssm ` Markdown fences as live state machines in VS Code's Markdown preview (the Mermaid-plugin mechanism: `extendMarkdownIt` + `markdown.previewScripts`). The portable fence grammar and its parser already shipped in **jssm@5.157.0** (`parse_fence_info`, `fsl_fence_lang` — PR StoneCypher/jssm#811, merged 2026-07-02). This extension is the deliberately *maximalist* interpreter: it ignores the grammar's element/format tokens and always renders the full live `<fsl-instance>` IDE **minus the editor**, honoring only `width`/`height`. Spec of record: `notes/superpowers/specs/2026-06-23-fsl-markdown-fence-convention-design.md` (§5 is this extension; a copy is in this scratch repo).

## Where execution stands

Executed via superpowers:subagent-driven-development (user's standing preference; subagent writes to this directory tree are CONFIRMED to work — tested 2026-07-02).

- **Task 1 (scaffold, manifest, build pipeline): DONE and reviewed.** Commits in this scratch repo: `515f7ac` scaffold, `29c944a` fix (pin `@types/vscode` to `1.90.0` exact — review finding: types must not drift past the `engines.vscode ^1.90.0` floor), `4316b06` housekeeping (`.superpowers/` ignored). `npm install`, `npm run build` (both bundles), and `npx tsc --noEmit` all verified green on this tree.
- **Task 2 (WASM-under-CSP spike): NOT STARTED — this is your resume point,** and it is a HARD GATE with a manual step: the user must press F5 and read the probe box (you cannot drive the Extension Development Host). Details and the documented fallback are in the plan.
- Tasks 3–9: not started.
- Review-findings ledger for the final whole-branch review (both Minor, deliberately deferred): (1) LICENSE says `2017-2026` range instead of the instructed year-2026 substitution; (2) `src/scripts/build.mjs` added `fileURLToPath`/`dirname` absolute-path plumbing the plan's version doesn't have — harmless, unrequested.

## Porting from this scratch repo into the template clone

The user created `vscode-fsl` from their React/TS + Claude GitHub template. Port rather than clone-and-overwrite:

1. **Copy in:** `notes/` (plan, spec, this file), `src/` (extension.ts, preview/preview.ts, scripts/build.mjs), `samples/` if present, `package.json` fields (see 3), `tsconfig.json`, `vitest.config.ts`, `.vscodeignore`, LICENSE decision per findings ledger. Do NOT copy `.superpowers/` (stale briefs/reports), `node_modules/`, `dist/`, or this scratch repo's git history — start fresh commits in the clone.
2. **Reconcile in the TEMPLATE's favor:** repo plumbing — GitHub workflows, `.claude/` config, lint setup, .gitignore base, README skeleton. The template is React-flavored; delete/skip React-specific app scaffolding (this is a VS Code extension, no React runtime), but keep its CI/Claude conventions.
3. **Reconcile in the PLAN's favor:** everything extension-mechanical — the `contributes` block (`markdown.markdownItPlugins: true`, `markdown.previewScripts: ["./dist/preview.js"]`), `main: ./dist/extension.js`, `engines.vscode ^1.90.0`, dependencies (`jssm ^5.157.0`, `lit ^3`, `@viz-js/viz ^3` — the last is REQUIRED even though nothing imports it directly: jssm dynamic-imports it without declaring it, and esbuild must resolve it into the preview bundle), devDependency `@types/vscode` pinned EXACT `1.90.0`, and the two-bundle esbuild build (host cjs/node/`vscode`-external; preview iife/browser/self-contained).
4. **Verify after port:** `npm install` → `npx tsc --noEmit` → `npm run build` produces `dist/extension.js` + `dist/preview.js`. Then resume the plan at Task 2.

## Decisions already made (don't relitigate)

- **Branch:** `main` (user explicitly chose the rename here; the clone will already be main).
- **Publisher:** `StoneCypher` is a PLACEHOLDER — confirm the real Marketplace publisher ID with the user before any publish. Publishing and pushing are user-gated actions.
- **Naming:** package `vscode-fsl`, displayName `FSL Markdown Preview`.
- **No `git config`, ever, without asking** — a Task 1 subagent set local user.name/email unasked and it was flagged as a violation. Put that warning in every implementer dispatch, alongside: no compound shell commands (no `&&`/`||`/`;`/pipes), npm from the Bash tool, one command per call.
- **Toolbar mounts with `no-validate no-lint`** (those buttons fire intents nothing in a preview fulfills — jssm #893 tracks the panel that would).
- **jssm Phase B (render helpers, gif encoder) is NOT consumed by this extension** — do not wait on it or build it here; it's separate jssm-repo work.

## Ground truths that cost real digging (trust these)

- jssm's viz is `@viz-js/viz` v3 (WASM), lazily `await import()`ed (`jssm src/ts/jssm_viz.ts` `get_viz()`); browser consumers normally resolve it via an import map — the extension instead bundles everything into one preview IIFE.
- The WASM-under-strict-CSP question for the Markdown preview webview is genuinely OPEN — hence the Task 2 spike. The fallback (host-side initial SVG render + live highlight via `<fsl-viz>`'s inline-style highlight API, no per-transition graphviz re-render needed) is sketched in the plan's Task 2 Step 4.
- `<fsl-instance>` accepts source via a `<script type="text/fsl">` child (safe for `<`/`&`), takes `theme="system|light|dark"`, and panels are explicit slotted children (`fsl-viz slot="viz"` etc.) registered by `jssm/wc/instance/define` + `jssm/wc/widgets/define`.
- The preview webview's `prefers-color-scheme` tracks the OS, not the VS Code theme — map the body's `vscode-dark`/`vscode-light`/`vscode-high-contrast*` classes instead (plan Task 7).
- The built-in preview dispatches `vscode.markdown.updateContent` on `window` on re-render; hydration must be idempotent (`data-fsl-hydrated` guard).

## The user

GitHub `StoneCypher`, runs several parallel Claude sessions ("call me Aesop"). Ask before anything public (repos, pushes, issues, publishes). Status reports use the status-checklists skill. They enjoy the work being done well more than being done fast.
