# vscode-fsl — FSL Markdown Preview Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A VS Code extension that renders ` ```fsl ` / ` ```jssm ` fenced code blocks in the Markdown *preview* as live, interactive FSL state machines (the full `<fsl-instance>` IDE, minus the editor), per Layer 2 of the approved fence-convention spec.

**Architecture:** Two bundles from one repo. The **extension-host bundle** (Node) contributes a markdown-it plugin via `extendMarkdownIt` that replaces FSL fences with an inert, escaped placeholder `<div class="fsl-fence">`. The **preview bundle** (browser, contributed via `markdown.previewScripts`) registers jssm's web components and *hydrates* each placeholder into a live `<fsl-instance>` composition. All rendering machinery (jssm, lit, @viz-js/viz) is bundled into the preview script by esbuild — no CDN, no import maps, works offline.

**Tech Stack:** TypeScript 5 (strict), esbuild, vitest + jsdom, markdown-it 14 (dev; VS Code supplies the runtime instance), `jssm@^5.157.0`, `lit@^3`, `@viz-js/viz@^3`, `@vscode/vsce`.

**Spec of record:** `notes/superpowers/specs/2026-06-23-fsl-markdown-fence-convention-design.md` in the jssm repo (§5 = this extension; §5.2 interpretation policy; §5.6 implementation concerns). A copy is checked into this repo at `notes/superpowers/specs/2026-06-23-fsl-markdown-fence-convention-design.md` by Task 1.

## Global Constraints

- **Interpretation policy (spec §5.2):** ignore all element/format tokens; ALWAYS render the full live IDE **less the `editor`** (viz + actions + info-panel + toolbar + title + footer); HONOR `width=` / `height=`.
- **Errors (spec §4.9/§5.5):** invalid FSL renders a visible error box in place — never a silent blank. The escaped source stays visible.
- **Graceful degradation:** if preview scripts don't run, the fence must still show readable, HTML-escaped FSL source.
- **Security:** all fence content is HTML-escaped host-side via `md.utils.escapeHtml`; the hydrator only ever reads `textContent` (never innerHTML of un-escaped content).
- **jssm floor: `^5.157.0`** — first version exporting `parse_fence_info` / `fsl_fence_lang` / `FenceDescriptor`.
- **VS Code engine floor: `^1.90.0`.**
- **Naming:** package `vscode-fsl`, displayName `FSL Markdown Preview`, publisher `StoneCypher` (placeholder — confirm the actual Marketplace publisher ID before any publish; publishing itself is out of scope for this plan).
- **Testing:** vitest; no golden-file/snapshot tests — assert substrings/identifiers and DOM structure. Every exported entity gets a DocBlock (one-line summary + example) per user policy.
- **Commits:** Conventional Commits, one commit per task minimum.
- **This repo never publishes on push** (unlike jssm) — no version-bump gate; Marketplace publishing is a deliberate later act by the user.

---

### Task 1: Scaffold, manifest, and build pipeline

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.vscodeignore`, `LICENSE`
- Create: `src/scripts/build.mjs` (esbuild driver — permanent script, so it lives in `src/scripts` per user policy)
- Create: `src/extension.ts`, `src/preview/preview.ts` (minimal stubs so the build has entry points)
- Create: `vitest.config.ts`
- Copy: the spec from the jssm worktree into `notes/superpowers/specs/2026-06-23-fsl-markdown-fence-convention-design.md`
- This plan file is already at `notes/superpowers/plans/2026-07-02-vscode-fsl-extension.md` — commit it here.

**Interfaces:**
- Produces: `npm run build` → `dist/extension.js` (cjs) + `dist/preview.js` (iife); `npm test` → vitest. Later tasks rely on these exact scripts.

- [ ] **Step 1: git init and baseline files**

```bash
git init
```

`package.json`:

```json
{
  "name": "vscode-fsl",
  "displayName": "FSL Markdown Preview",
  "description": "Live FSL / jssm state machines in VS Code's Markdown preview",
  "version": "0.1.0",
  "publisher": "StoneCypher",
  "license": "MIT",
  "repository": { "type": "git", "url": "https://github.com/StoneCypher/vscode-fsl" },
  "engines": { "vscode": "^1.90.0" },
  "categories": ["Visualization", "Other"],
  "keywords": ["fsl", "jssm", "state machine", "markdown", "preview", "diagram"],
  "main": "./dist/extension.js",
  "activationEvents": ["onLanguage:markdown"],
  "contributes": {
    "markdown.markdownItPlugins": true,
    "markdown.previewScripts": ["./dist/preview.js"]
  },
  "scripts": {
    "build": "node src/scripts/build.mjs",
    "test": "vitest run",
    "package": "vsce package"
  },
  "dependencies": {
    "@viz-js/viz": "^3",
    "jssm": "^5.157.0",
    "lit": "^3"
  },
  "devDependencies": {
    "@types/markdown-it": "^14",
    "@types/node": "^22",
    "@types/vscode": "^1.90.0",
    "@vscode/vsce": "^3",
    "esbuild": "^0.24",
    "jsdom": "^25",
    "markdown-it": "^14",
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

Note: `@viz-js/viz` is a **direct dependency on purpose** — jssm's viz layer dynamic-imports it (`await import('@viz-js/viz')`, see jssm `src/ts/jssm_viz.ts` `get_viz()`) but does not list it in its own `dependencies`; declaring it here lets esbuild resolve that dynamic import into the preview bundle.

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node", "vscode"]
  },
  "include": ["src"]
}
```

`.gitignore`:

```
node_modules/
dist/
*.vsix
build/
```

`.vscodeignore` (keeps the VSIX lean — ship only manifest, dist, license, readme):

```
**
!dist/**
!package.json
!README.md
!CHANGELOG.md
!LICENSE
```

`LICENSE`: MIT, copyright John Haugeland (copy the license text from the jssm repo's `LICENSE` file, updating the year to 2026).

- [ ] **Step 2: entry-point stubs**

`src/extension.ts`:

```typescript
import type MarkdownIt from 'markdown-it';

/**
 *  VS Code activation hook.  Returns the markdown-it extension point; the
 *  built-in Markdown extension calls `extendMarkdownIt` when building the
 *  preview renderer.  Task 4 wires the real fence plugin in.
 */
export function activate(): { extendMarkdownIt(md: MarkdownIt): MarkdownIt } {
  return { extendMarkdownIt: (md: MarkdownIt): MarkdownIt => md };
}

/** VS Code deactivation hook.  Nothing to release. */
export function deactivate(): void { /* nothing to release */ }
```

`src/preview/preview.ts`:

```typescript
/** Preview-webview entry point.  Task 2 adds the CSP probe; Task 7 the hydrator. */
export {};
```

- [ ] **Step 3: build script**

`src/scripts/build.mjs`:

```javascript
/**
 *  Builds both bundles: the extension-host bundle (Node/CJS, `vscode` external)
 *  and the preview-webview bundle (browser/IIFE, fully self-contained —
 *  includes jssm, lit, and @viz-js/viz so the webview needs no network).
 *
 *  Run: `node src/scripts/build.mjs`
 */
import { build } from 'esbuild';

await build({
  entryPoints : ['src/extension.ts'],
  bundle      : true,
  outfile     : 'dist/extension.js',
  format      : 'cjs',
  platform    : 'node',
  target      : 'node18',
  external    : ['vscode'],
  sourcemap   : true,
});

await build({
  entryPoints : ['src/preview/preview.ts'],
  bundle      : true,
  outfile     : 'dist/preview.js',
  format      : 'iife',
  platform    : 'browser',
  target      : 'es2022',
  sourcemap   : true,
  logOverride : { 'empty-import-meta': 'silent' },
});
```

(`logOverride` quiets emscripten `import.meta` shims inside @viz-js/viz when bundling to IIFE; if the build surfaces a different warning name, adjust to the name esbuild reports.)

`vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include     : ['src/**/*.spec.ts'],
    environment : 'node',
  },
});
```

- [ ] **Step 4: install and build**

Run: `npm install` then `npm run build`
Expected: exit 0; `dist/extension.js` and `dist/preview.js` exist.

- [ ] **Step 5: copy the spec in**

Copy `notes/superpowers/specs/2026-06-23-fsl-markdown-fence-convention-design.md` from the jssm fence worktree (`C:\Users\john\projects\worktrees\stonecypher_jssm_feat_26-06-23_fsl-markdown-fence`) into the same relative path here.

- [ ] **Step 6: commit**

```bash
git add -A
git commit -m "chore: scaffold vscode-fsl (manifest, build pipeline, spec, plan)"
```

---

### Task 2: Spike — WASM under the Markdown-preview CSP (decision gate)

**Why this is first:** `@viz-js/viz` v3 is WebAssembly. VS Code's Markdown preview runs a strict CSP that may not include `'wasm-unsafe-eval'`, in which case Graphviz cannot instantiate in the webview and the rendering strategy must change. Every later task is cheap to build on either answer — but only if we know the answer. **Do not skip or defer this.**

**Files:**
- Modify: `src/preview/preview.ts`
- Create: `samples/demo.md`
- Create: `notes/spikes/2026-07-02-wasm-under-preview-csp.md` (records the observed result)

**Interfaces:**
- Produces: a written GO / NO-GO decision that Task 7 consumes.

- [ ] **Step 1: add the probe to the preview entry**

`src/preview/preview.ts`:

```typescript
/**
 *  Preview-webview entry point.  Currently: a temporary CSP probe (Task 2)
 *  that reports whether WebAssembly can instantiate inside the Markdown
 *  preview.  Replaced by the real hydrator in Task 7.
 */

/** The smallest valid wasm module: magic number + version, nothing else. */
const WASM_EMPTY = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

async function probe_wasm(): Promise<string> {
  try {
    await WebAssembly.instantiate(WASM_EMPTY);
    return 'WASM OK — @viz-js/viz can run in this webview';
  } catch (e) {
    return `WASM BLOCKED — ${(e as Error).message}`;
  }
}

async function show_probe(): Promise<void> {
  const box = document.createElement('div');
  box.style.cssText = 'border:2px solid orange; padding:8px; font-family:monospace;';
  box.textContent = `[vscode-fsl spike] ${await probe_wasm()}`;
  document.body.prepend(box);
}

void show_probe();
```

- [ ] **Step 2: sample document**

`samples/demo.md`:

````markdown
# vscode-fsl demo

A traffic light:

```fsl
Red -> Green -> Yellow -> Red;
```

Sized:

```fsl width=300
Off 'toggle' <-> On;
```

Not ours (must stay a normal code block):

```js
const x = 1;
```

Broken on purpose (error-box case):

```fsl
this is not -> valid ->;
```
````

- [ ] **Step 3: build and run the probe manually**

Run: `npm run build`, then open this repo in VS Code, press **F5** (Extension Development Host), open `samples/demo.md`, run **Markdown: Open Preview** (Ctrl+Shift+V). Read the orange probe box at the top of the preview.

Expected: the box shows either `WASM OK` or `WASM BLOCKED — <reason>`.

- [ ] **Step 4: record the decision**

Write `notes/spikes/2026-07-02-wasm-under-preview-csp.md` with: the exact probe text observed, the VS Code version, and the decision:

- **WASM OK →** proceed exactly as planned (Tasks 3–9 unchanged).
- **WASM BLOCKED →** adopt the fallback: the *initial* SVG is rendered **host-side** (the markdown-it plugin calls jssm/viz in Node — proven to work there — and inlines the SVG into the placeholder div), and the preview bundle mounts `<fsl-instance>` around the pre-rendered SVG for live state *highlighting only* (jssm's `<fsl-viz>` applies highlights as inline style overrides on the existing SVG — no Graphviz re-render needed per transition; see jssm `src/doc_md/WebComponents.md` "highlight" section). Tasks 5 and 7 change shape; STOP and re-plan those two tasks with your human partner before continuing.

- [ ] **Step 5: commit**

```bash
git add -A
git commit -m "chore(spike): WASM-under-preview-CSP probe + sample doc + recorded decision"
```

---

### Task 3: The markdown-it fence plugin (host side, pure)

**Files:**
- Create: `src/fence_plugin.ts`
- Test: `src/tests/fence_plugin.spec.ts`

**Interfaces:**
- Consumes: `fsl_fence_lang(info: string): 'fsl' | 'jssm' | null`, `parse_fence_info(info: string): FenceDescriptor`, `FenceDimension { value: number; unit: 'px' | 'percent' }` — all from `jssm`.
- Produces: `fsl_fence_plugin(md: MarkdownIt): void` and `dimension_to_css(dim: FenceDimension | null): string`. Emitted placeholder shape (Tasks 5–7 rely on it):
  `<div class="fsl-fence" data-width="300px" data-height=""><pre class="fsl-fence-source"><code>ESCAPED SOURCE</code></pre></div>`

- [ ] **Step 1: write the failing tests**

`src/tests/fence_plugin.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import MarkdownIt              from 'markdown-it';
import { fsl_fence_plugin, dimension_to_css } from '../fence_plugin.js';

const make_md = (): MarkdownIt => {
  const m = new MarkdownIt();
  fsl_fence_plugin(m);
  return m;
};

describe('dimension_to_css', () => {

  it('serializes null, px, and percent', () => {
    expect(dimension_to_css(null)).toBe('');
    expect(dimension_to_css({ value: 300, unit: 'px'      })).toBe('300px');
    expect(dimension_to_css({ value: 50,  unit: 'percent' })).toBe('50%');
  });

});

describe('fsl_fence_plugin', () => {

  it('renders an fsl fence as a hydration placeholder with escaped source', () => {
    const html = make_md().render('```fsl\na -> b;\n```\n');
    expect(html).toContain('class="fsl-fence"');
    expect(html).toContain('fsl-fence-source');
    expect(html).toContain('a -&gt; b;');
  });

  it('accepts the jssm synonym, case-insensitively', () => {
    expect(make_md().render('```JSSM\na -> b;\n```\n')).toContain('class="fsl-fence"');
  });

  it('leaves non-fsl fences to the default renderer', () => {
    const html = make_md().render('```js\nconst x = 1;\n```\n');
    expect(html).not.toContain('fsl-fence');
    expect(html).toContain('language-js');
  });

  it('leaves plain (no-language) fences alone', () => {
    expect(make_md().render('```\nplain\n```\n')).not.toContain('fsl-fence');
  });

  it('escapes HTML in machine source — no script injection', () => {
    const html = make_md().render('```fsl\na "<script>alert(1)</script>" -> b;\n```\n');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('carries width/height through as CSS lengths in data attributes', () => {
    const html = make_md().render('```fsl width=300 height=50%\na -> b;\n```\n');
    expect(html).toContain('data-width="300px"');
    expect(html).toContain('data-height="50%"');
  });

  it('emits empty data attributes when no dimensions are given', () => {
    const html = make_md().render('```fsl\na -> b;\n```\n');
    expect(html).toContain('data-width=""');
    expect(html).toContain('data-height=""');
  });

});
```

- [ ] **Step 2: run to verify failure**

Run: `npx vitest run src/tests/fence_plugin.spec.ts`
Expected: FAIL — `Cannot find module '../fence_plugin.js'`.

- [ ] **Step 3: implement**

`src/fence_plugin.ts`:

```typescript
import type MarkdownIt from 'markdown-it';
import { fsl_fence_lang, parse_fence_info } from 'jssm';
import type { FenceDimension } from 'jssm';

/**
 *  Serialize a parsed fence dimension to a CSS length, or `''` when unset.
 *  Percent dimensions parse with unit `'percent'` and serialize as `%`.
 *
 *  @example
 *  dimension_to_css({ value: 300, unit: 'px' });  // '300px'
 */
export function dimension_to_css(dim: FenceDimension | null): string {
  if (dim === null) { return ''; }
  return `${dim.value}${dim.unit === 'percent' ? '%' : 'px'}`;
}

/**
 *  markdown-it plugin: replaces ```fsl / ```jssm fences with an inert
 *  hydration placeholder — a `.fsl-fence` div carrying width/height data
 *  attributes and the HTML-escaped FSL source in a `.fsl-fence-source`
 *  pre/code (which is also the graceful-degradation view when preview
 *  scripts don't run).  All other fences fall through to the previous
 *  fence renderer untouched.
 *
 *  Per spec §5.2 the element/format tokens are deliberately ignored here;
 *  only width/height survive into the placeholder.
 *
 *  @example
 *  const md = new MarkdownIt();
 *  fsl_fence_plugin(md);
 *  md.render('```fsl width=300\na -> b;\n```\n');
 *  // '<div class="fsl-fence" data-width="300px" data-height="">…'
 */
export function fsl_fence_plugin(md: MarkdownIt): void {

  const prior = md.renderer.rules.fence;

  md.renderer.rules.fence = function (tokens, idx, options, env, self): string {

    const token = tokens[idx];
    if (token === undefined) { return ''; }

    const info = token.info ?? '';
    if (fsl_fence_lang(info) === null) {
      return prior !== undefined
        ? prior.call(this, tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options);
    }

    const desc = parse_fence_info(info);
    const esc  = md.utils.escapeHtml;

    return `<div class="fsl-fence" data-width="${esc(dimension_to_css(desc.width))}"`
         + ` data-height="${esc(dimension_to_css(desc.height))}">`
         + `<pre class="fsl-fence-source"><code>${esc(token.content)}</code></pre>`
         + `</div>\n`;
  };

}
```

- [ ] **Step 4: run to verify pass**

Run: `npx vitest run src/tests/fence_plugin.spec.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: commit**

```bash
git add src/fence_plugin.ts src/tests/fence_plugin.spec.ts
git commit -m "feat: markdown-it fence plugin — fsl/jssm fences become hydration placeholders"
```

---

### Task 4: Extension entry — wire the plugin into `extendMarkdownIt`

**Files:**
- Modify: `src/extension.ts`
- Test: `src/tests/extension.spec.ts`

**Interfaces:**
- Consumes: `fsl_fence_plugin` (Task 3).
- Produces: `activate(): { extendMarkdownIt(md: MarkdownIt): MarkdownIt }` — the shape VS Code's built-in Markdown extension expects. Deliberately imports nothing from `'vscode'` so it stays unit-testable in plain vitest.

- [ ] **Step 1: write the failing test**

`src/tests/extension.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import MarkdownIt              from 'markdown-it';
import { activate }            from '../extension.js';

describe('activate', () => {

  it('returns an extendMarkdownIt that installs the fsl fence rule', () => {
    const api = activate();
    const md  = api.extendMarkdownIt(new MarkdownIt());
    expect(md.render('```fsl\na -> b;\n```\n')).toContain('class="fsl-fence"');
  });

  it('returns the same markdown-it instance it was given', () => {
    const md = new MarkdownIt();
    expect(activate().extendMarkdownIt(md)).toBe(md);
  });

});
```

- [ ] **Step 2: run to verify failure**

Run: `npx vitest run src/tests/extension.spec.ts`
Expected: FAIL — the stub's `extendMarkdownIt` doesn't install the rule, so the first assertion fails.

- [ ] **Step 3: implement**

`src/extension.ts` (replaces the stub):

```typescript
import type MarkdownIt      from 'markdown-it';
import { fsl_fence_plugin } from './fence_plugin.js';

/**
 *  VS Code activation hook.  Returns the markdown-it extension point; the
 *  built-in Markdown extension calls `extendMarkdownIt` once when building
 *  the preview renderer, and the plugin installed there rewrites fsl/jssm
 *  fences into hydration placeholders (see fence_plugin.ts).
 *
 *  Imports nothing from 'vscode' by design — everything here is pure and
 *  unit-testable.
 *
 *  @example
 *  const md = activate().extendMarkdownIt(new MarkdownIt());
 *  md.render('```fsl\na -> b;\n```\n');  // contains class="fsl-fence"
 */
export function activate(): { extendMarkdownIt(md: MarkdownIt): MarkdownIt } {
  return {
    extendMarkdownIt(md: MarkdownIt): MarkdownIt {
      fsl_fence_plugin(md);
      return md;
    },
  };
}

/** VS Code deactivation hook.  Nothing to release. */
export function deactivate(): void { /* nothing to release */ }
```

- [ ] **Step 4: run to verify pass**

Run: `npx vitest run src/tests/extension.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: commit**

```bash
git add src/extension.ts src/tests/extension.spec.ts
git commit -m "feat: activate() wires the fence plugin into extendMarkdownIt"
```

---

### Task 5: The hydrator (webview side, pure DOM)

**Files:**
- Create: `src/preview/hydrate.ts`
- Test: `src/tests/hydrate.spec.ts`

**Interfaces:**
- Consumes: the placeholder shape from Task 3 (`.fsl-fence` div, `data-width`/`data-height`, `.fsl-fence-source` text).
- Produces: `hydrate_fence(fence: HTMLElement): void` and `hydrate_all(root: ParentNode): void`. The mounted composition (Task 7 relies on the `fsl-instance` tag; Task 6 hooks the validation seam):

```html
<fsl-instance theme="system" style="width:…; height:…">
  <span slot="title">FSL machine</span>
  <fsl-viz slot="viz"></fsl-viz>
  <fsl-toolbar slot="toolbar" no-validate no-lint></fsl-toolbar>
  <fsl-actions slot="actions"></fsl-actions>
  <fsl-info-panel slot="info-panel"></fsl-info-panel>
  <fsl-footer slot="footer"></fsl-footer>
  <script type="text/fsl">SOURCE</script>
</fsl-instance>
```

Design notes locked in:
- Source is delivered via the `<script type="text/fsl">` child — jssm's documented channel for FSL containing `<` or `&` (see jssm `src/doc_md/WebComponents.md`).
- **No `fsl-editor` child, ever** (spec §5.2 — VS Code *is* the editor).
- Toolbar gets `no-validate no-lint`: those toolbar buttons fire intents nothing in a preview fulfills (see jssm `fsl_toolbar_wc.ts`), so they'd be dead buttons.
- Hydration is idempotent via a `data-fsl-hydrated` marker — the preview re-fires renders and the hydrator must not double-mount.
- In jsdom, custom elements don't upgrade (no defines are imported in tests) — tests assert **structure**, which is exactly what this module produces.

- [ ] **Step 1: write the failing tests**

`src/tests/hydrate.spec.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { hydrate_fence, hydrate_all } from '../preview/hydrate.js';

/** Build a placeholder div exactly as fence_plugin emits it. */
function make_fence(source: string, width = '', height = ''): HTMLElement {
  const div = document.createElement('div');
  div.className = 'fsl-fence';
  div.setAttribute('data-width',  width);
  div.setAttribute('data-height', height);
  const pre  = document.createElement('pre');
  pre.className = 'fsl-fence-source';
  const code = document.createElement('code');
  code.textContent = source;
  pre.appendChild(code);
  div.appendChild(pre);
  document.body.appendChild(div);
  return div;
}

describe('hydrate_fence', () => {

  it('mounts an fsl-instance with the source in a text/fsl script child', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    const instance = fence.querySelector('fsl-instance');
    expect(instance).not.toBeNull();
    const script = instance!.querySelector('script[type="text/fsl"]');
    expect(script?.textContent).toBe('a -> b;');
  });

  it('mounts viz, toolbar, actions, info-panel, and footer into their slots', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    for (const [tag, slot] of [
      ['fsl-viz', 'viz'], ['fsl-toolbar', 'toolbar'], ['fsl-actions', 'actions'],
      ['fsl-info-panel', 'info-panel'], ['fsl-footer', 'footer'],
    ]) {
      expect(fence.querySelector(`${tag}[slot="${slot}"]`), `${tag} missing`).not.toBeNull();
    }
  });

  it('never mounts an editor (spec §5.2 — VS Code is the editor)', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    expect(fence.querySelector('fsl-editor')).toBeNull();
  });

  it('suppresses the toolbar validate/lint intents', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    const toolbar = fence.querySelector('fsl-toolbar');
    expect(toolbar?.hasAttribute('no-validate')).toBe(true);
    expect(toolbar?.hasAttribute('no-lint')).toBe(true);
  });

  it('applies width and height to the instance style', () => {
    const fence = make_fence('a -> b;', '300px', '50%');
    hydrate_fence(fence);
    const instance = fence.querySelector('fsl-instance') as HTMLElement;
    expect(instance.style.width).toBe('300px');
    expect(instance.style.height).toBe('50%');
  });

  it('is idempotent — a second call does not double-mount', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    hydrate_fence(fence);
    expect(fence.querySelectorAll('fsl-instance').length).toBe(1);
  });

});

describe('hydrate_all', () => {

  it('hydrates every .fsl-fence under the root', () => {
    document.body.innerHTML = '';
    make_fence('a -> b;');
    make_fence('c -> d;');
    hydrate_all(document);
    expect(document.querySelectorAll('fsl-instance').length).toBe(2);
  });

});
```

- [ ] **Step 2: run to verify failure**

Run: `npx vitest run src/tests/hydrate.spec.ts`
Expected: FAIL — `Cannot find module '../preview/hydrate.js'`.

- [ ] **Step 3: implement**

`src/preview/hydrate.ts`:

```typescript
/** Marker attribute preventing double-hydration across preview re-renders. */
const HYDRATED = 'data-fsl-hydrated';

/** The slotted panels of the always-full-IDE composition (spec §5.2) — no editor. */
const PANELS: ReadonlyArray<readonly [tag: string, slot: string]> = [
  ['fsl-viz',        'viz'],
  ['fsl-toolbar',    'toolbar'],
  ['fsl-actions',    'actions'],
  ['fsl-info-panel', 'info-panel'],
  ['fsl-footer',     'footer'],
];

/**
 *  Replace one `.fsl-fence` placeholder with a live `<fsl-instance>`
 *  composition (viz + toolbar + actions + info-panel + footer; never an
 *  editor).  The FSL source travels in a `<script type="text/fsl">` child —
 *  jssm's safe channel for source containing `<` or `&`.  Idempotent: a
 *  fence already carrying `data-fsl-hydrated` is left untouched.
 *
 *  @example
 *  hydrate_fence(document.querySelector('.fsl-fence')!);
 *  // the div now contains <fsl-instance>…</fsl-instance>
 */
export function hydrate_fence(fence: HTMLElement): void {

  if (fence.hasAttribute(HYDRATED)) { return; }
  fence.setAttribute(HYDRATED, 'true');

  const doc    = fence.ownerDocument;
  const source = fence.querySelector('.fsl-fence-source')?.textContent ?? '';

  const instance = doc.createElement('fsl-instance');
  instance.setAttribute('theme', 'system');

  const width  = fence.getAttribute('data-width')  ?? '';
  const height = fence.getAttribute('data-height') ?? '';
  if (width  !== '') { instance.style.width  = width;  }
  if (height !== '') { instance.style.height = height; }

  const title = doc.createElement('span');
  title.setAttribute('slot', 'title');
  title.textContent = 'FSL machine';
  instance.appendChild(title);

  for (const [tag, slot] of PANELS) {
    const el = doc.createElement(tag);
    el.setAttribute('slot', slot);
    if (tag === 'fsl-toolbar') {
      el.setAttribute('no-validate', '');
      el.setAttribute('no-lint', '');
    }
    instance.appendChild(el);
  }

  const script = doc.createElement('script');
  script.setAttribute('type', 'text/fsl');
  script.textContent = source;
  instance.appendChild(script);

  fence.replaceChildren(instance);

}

/**
 *  Hydrate every `.fsl-fence` placeholder under `root`.  Safe to call
 *  repeatedly (per-fence idempotence guard).
 *
 *  @example
 *  hydrate_all(document);
 */
export function hydrate_all(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>('.fsl-fence')) {
    hydrate_fence(el);
  }
}
```

- [ ] **Step 4: run to verify pass**

Run: `npx vitest run src/tests/hydrate.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: commit**

```bash
git add src/preview/hydrate.ts src/tests/hydrate.spec.ts
git commit -m "feat: hydrator — .fsl-fence placeholders become live fsl-instance compositions"
```

---

### Task 6: Error box — invalid FSL renders visibly, never blank

**Files:**
- Modify: `src/preview/hydrate.ts`
- Test: `src/tests/hydrate_errors.spec.ts`

**Interfaces:**
- Consumes: `sm` tagged-template from `jssm` (constructing a machine is the validation — it throws `JssmError` with a message on bad source).
- Produces: on invalid source, `hydrate_fence` renders `<div class="fsl-error-box"><strong>FSL error</strong><pre>MESSAGE</pre></div>` **before** the still-visible escaped source, and mounts no instance (spec §4.9/§5.5).

Design note: validation constructs the machine once in the hydrator (cheap relative to a preview render) so a broken machine never reaches `<fsl-instance>`; the live instance then re-parses its own copy, which is fine.

- [ ] **Step 1: write the failing tests**

`src/tests/hydrate_errors.spec.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { hydrate_fence } from '../preview/hydrate.js';

function make_fence(source: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'fsl-fence';
  div.setAttribute('data-width', '');
  div.setAttribute('data-height', '');
  const pre  = document.createElement('pre');
  pre.className = 'fsl-fence-source';
  const code = document.createElement('code');
  code.textContent = source;
  pre.appendChild(code);
  div.appendChild(pre);
  document.body.appendChild(div);
  return div;
}

describe('hydrate_fence with invalid FSL', () => {

  it('renders a visible error box and mounts no instance', () => {
    const fence = make_fence('this is not -> valid ->;');
    hydrate_fence(fence);
    const box = fence.querySelector('.fsl-error-box');
    expect(box).not.toBeNull();
    expect(box!.textContent).toContain('FSL error');
    expect(fence.querySelector('fsl-instance')).toBeNull();
  });

  it('keeps the escaped source visible beneath the error box', () => {
    const fence = make_fence('this is not -> valid ->;');
    hydrate_fence(fence);
    expect(fence.querySelector('.fsl-fence-source')).not.toBeNull();
  });

  it('still mounts normally for valid FSL (regression)', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    expect(fence.querySelector('fsl-instance')).not.toBeNull();
    expect(fence.querySelector('.fsl-error-box')).toBeNull();
  });

});
```

- [ ] **Step 2: run to verify failure**

Run: `npx vitest run src/tests/hydrate_errors.spec.ts`
Expected: FAIL — no error box is rendered (invalid source currently mounts an instance).

- [ ] **Step 3: implement**

In `src/preview/hydrate.ts`, add the import at the top:

```typescript
import { sm } from 'jssm';
```

Add before `hydrate_fence`:

```typescript
/**
 *  Validate FSL by constructing a machine; returns the error message on
 *  failure, `null` on success.  Constructing is the only complete
 *  validation — anything less accepts source the instance would choke on.
 *
 *  @example
 *  validate_fsl('a -> b;');   // null
 *  validate_fsl('a -> -> ;'); // 'jssm parse error: …'
 */
export function validate_fsl(source: string): string | null {
  try {
    sm`${source}`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/**
 *  Prepend a visible error box (spec §4.9: never a silent blank) to a fence,
 *  leaving the escaped source visible beneath it.
 */
function render_error_box(fence: HTMLElement, message: string): void {
  const doc   = fence.ownerDocument;
  const box   = doc.createElement('div');
  box.className = 'fsl-error-box';
  const title = doc.createElement('strong');
  title.textContent = 'FSL error';
  const body  = doc.createElement('pre');
  body.textContent = message;
  box.append(title, body);
  fence.prepend(box);
}
```

Then, inside `hydrate_fence`, immediately after the `source` is read (before creating the instance), insert:

```typescript
  const error = validate_fsl(source);
  if (error !== null) {
    render_error_box(fence, error);
    return;
  }
```

(The `HYDRATED` marker is already set by then, so a broken fence isn't retried on every preview update.)

- [ ] **Step 4: run to verify pass**

Run: `npx vitest run src/tests/hydrate_errors.spec.ts` and then the full `npx vitest run`
Expected: PASS; all prior suites still green.

- [ ] **Step 5: commit**

```bash
git add src/preview/hydrate.ts src/tests/hydrate_errors.spec.ts
git commit -m "feat: visible error box for invalid FSL; source stays readable"
```

---

### Task 7: Preview entry — defines, update events, theming, styles

**Files:**
- Modify: `src/preview/preview.ts` (replaces the Task-2 probe)
- Create: `src/preview/theme.ts`
- Test: `src/tests/theme.spec.ts`

**Interfaces:**
- Consumes: `hydrate_all` (Task 5); jssm side-effect defines `jssm/wc/instance/define` and `jssm/wc/widgets/define` (register `<fsl-instance>`, `<fsl-viz>`, `<fsl-toolbar>`, `<fsl-actions>`, `<fsl-info-panel>`, `<fsl-footer>`, and the rest of the panel ring).
- Produces: `theme_for_body_classes(classList: DOMTokenList): 'light' | 'dark'` (pure, tested); the assembled preview entry (verified manually in Task 8 — webview behavior isn't reachable from vitest).

Design notes locked in:
- VS Code marks the preview body with `vscode-light` / `vscode-dark` / `vscode-high-contrast` / `vscode-high-contrast-light` classes. `<fsl-instance theme="…">` accepts `'system' | 'light' | 'dark'` (jssm `fsl_themes.ts` `ThemeMode`); the entry maps body classes to a concrete variant instead of `system`, because the webview's `prefers-color-scheme` tracks the OS, not the VS Code theme.
- The built-in Markdown preview dispatches `vscode.markdown.updateContent` on `window` when it re-renders the body — re-run `hydrate_all` and re-apply theme there (the `data-fsl-hydrated` guard makes this cheap).
- A theme `MutationObserver` on `document.body`'s `class` catches live theme switches without a preview re-render.

- [ ] **Step 1: write the failing theme test**

`src/tests/theme.spec.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { theme_for_body_classes } from '../preview/theme.js';

const classes = (...names: string[]): DOMTokenList => {
  const el = document.createElement('div');
  for (const n of names) { el.classList.add(n); }
  return el.classList;
};

describe('theme_for_body_classes', () => {

  it('maps vscode-dark and vscode-high-contrast to dark', () => {
    expect(theme_for_body_classes(classes('vscode-dark'))).toBe('dark');
    expect(theme_for_body_classes(classes('vscode-high-contrast'))).toBe('dark');
  });

  it('maps vscode-light and high-contrast-light to light', () => {
    expect(theme_for_body_classes(classes('vscode-light'))).toBe('light');
    expect(theme_for_body_classes(classes('vscode-high-contrast-light'))).toBe('light');
  });

  it('defaults to light when no vscode class is present', () => {
    expect(theme_for_body_classes(classes('unrelated'))).toBe('light');
  });

});
```

- [ ] **Step 2: run to verify failure**

Run: `npx vitest run src/tests/theme.spec.ts`
Expected: FAIL — `Cannot find module '../preview/theme.js'`.

- [ ] **Step 3: implement the theme helper**

`src/preview/theme.ts`:

```typescript
/**
 *  Map the VS Code preview body's theme classes to a concrete fsl-instance
 *  theme variant.  `vscode-high-contrast` (dark HC) counts as dark;
 *  `vscode-high-contrast-light` as light; unknown defaults to light.
 *
 *  The webview's own `prefers-color-scheme` tracks the OS rather than the
 *  VS Code theme, so `<fsl-instance theme="system">` would follow the wrong
 *  signal — this helper exists to follow the editor instead.
 *
 *  @example
 *  theme_for_body_classes(document.body.classList);  // 'dark'
 */
export function theme_for_body_classes(classList: DOMTokenList): 'light' | 'dark' {
  if (classList.contains('vscode-high-contrast-light')) { return 'light'; }
  if (classList.contains('vscode-dark'))                { return 'dark';  }
  if (classList.contains('vscode-high-contrast'))       { return 'dark';  }
  return 'light';
}
```

- [ ] **Step 4: run to verify pass**

Run: `npx vitest run src/tests/theme.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: assemble the preview entry (replaces the spike probe)**

`src/preview/preview.ts`:

```typescript
/**
 *  Preview-webview entry point.  Registers jssm's web components, hydrates
 *  every fsl fence placeholder, keeps hydration current across preview
 *  re-renders (`vscode.markdown.updateContent`), and keeps the instances'
 *  theme in step with the VS Code theme.
 */
import 'jssm/wc/instance/define';
import 'jssm/wc/widgets/define';

import { hydrate_all }            from './hydrate.js';
import { theme_for_body_classes } from './theme.js';

/** Injected once: error-box styling + fence spacing. */
const STYLES = `
  .fsl-error-box { border: 2px solid #c53; border-radius: 4px; padding: 8px 12px; margin: 8px 0; }
  .fsl-error-box strong { color: #c53; display: block; margin-bottom: 4px; }
  .fsl-error-box pre { margin: 0; white-space: pre-wrap; }
  .fsl-fence { margin: 8px 0; }
`;

function inject_styles(): void {
  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function apply_theme(): void {
  const variant = theme_for_body_classes(document.body.classList);
  for (const el of document.querySelectorAll('fsl-instance')) {
    el.setAttribute('theme', variant);
  }
}

function refresh(): void {
  hydrate_all(document);
  apply_theme();
}

inject_styles();
refresh();

window.addEventListener('vscode.markdown.updateContent', refresh);

new MutationObserver(apply_theme)
  .observe(document.body, { attributes: true, attributeFilter: ['class'] });
```

- [ ] **Step 6: full test suite + build**

Run: `npx vitest run` then `npm run build`
Expected: all suites PASS; both bundles build. Note the preview bundle will now be large (~5 MB with sourcemap excluded) — that is expected and fine for a local webview script.

- [ ] **Step 7: commit**

```bash
git add src/preview/preview.ts src/preview/theme.ts src/tests/theme.spec.ts
git commit -m "feat: preview entry — defines, hydration lifecycle, VS Code theming"
```

---

### Task 8: End-to-end verification + VSIX packaging

**Files:**
- Modify: `samples/demo.md` (only if gaps are found)
- Create: `notes/manual-test-checklist.md`

**Interfaces:**
- Consumes: everything.
- Produces: a working `.vsix` and a recorded manual-verification result.

- [ ] **Step 1: build and launch**

Run: `npm run build`, press **F5**, open `samples/demo.md`, **Markdown: Open Preview**.

- [ ] **Step 2: walk the checklist**

Write `notes/manual-test-checklist.md` and check each item against the running preview:

```markdown
# Manual verification — vscode-fsl

- [ ] Traffic-light fence renders a live diagram (not a code block)
- [ ] Clicking an action button transitions the machine; viz highlight follows
- [ ] info-panel shows current state + legal actions and updates on click
- [ ] width=300 fence is 300px wide
- [ ] ```js fence still renders as a normal highlighted code block
- [ ] Broken fence shows the FSL error box with the source visible beneath
- [ ] Editing the .md re-renders the preview; machines re-hydrate (no double-mount, no dead panels)
- [ ] Switching VS Code light/dark theme restyles the instances without reload
- [ ] Two fsl fences in one document run independently
- [ ] No errors in the webview devtools console (Developer: Open Webview Developer Tools)
```

Record pass/fail per item in the file. Fix what fails before proceeding — each fix gets its own conventional commit.

- [ ] **Step 3: package**

Run: `npx vsce package`
Expected: `vscode-fsl-0.1.0.vsix` produced without errors (the `.vscodeignore` from Task 1 keeps it to dist + manifest + docs).

- [ ] **Step 4: commit**

```bash
git add notes/manual-test-checklist.md samples/demo.md
git commit -m "test: manual e2e checklist walked; vsix packages clean"
```

---

### Task 9: README, CHANGELOG, final review

**Files:**
- Create: `README.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: everything; produces the public face.

- [ ] **Step 1: write the README**

`README.md` must cover, in this order: what it does (one screenshot placeholder + one fence example); install (from VSIX for now — Marketplace publishing is a separate later act); the fence convention in one table (language tokens; the note that **this extension deliberately ignores element/format tokens and always renders the live IDE**, honoring only `width`/`height` — link to the jssm spec for the full portable grammar); the error-box behavior; theming; and a Development section (`npm install`, `npm run build`, `npm test`, F5). Example fence to include:

````markdown
```fsl width=400
Red -> Green -> Yellow -> Red;
```
````

- [ ] **Step 2: write the CHANGELOG**

`CHANGELOG.md`: single `0.1.0` entry summarizing the feature set (live preview of fsl/jssm fences, full IDE less editor, width/height, error boxes, light/dark theming).

- [ ] **Step 3: final self-review**

Re-read spec §5 top to bottom; confirm each bullet maps to shipped behavior (§5.1 mechanism → Tasks 3/4; §5.2 policy → Tasks 3/5; §5.3 live rendering → Tasks 5/7; §5.4 theming → Task 7; §5.5 errors → Task 6; §5.6 concerns → Tasks 1/2/7/8). Run the full suite one last time: `npx vitest run` and `npm run build`.

- [ ] **Step 4: commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: README + CHANGELOG for 0.1.0"
```

---

## Out of scope (tracked elsewhere, do not build here)

- **Marketplace publishing** — user's call; needs the real publisher ID.
- **GitHub repo creation / first push** — user's call (public action).
- **jssm Phase B** (render helpers + gif encoder) — separate plan in the jssm repo; not consumed by this extension.
- **Static escape hatch setting** — spec §3 deferral.
- **Performance work for many-machine documents** — spec §5.6 says revisit if it bites.
