# vscode-fsl — FSL Markdown Preview Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A VS Code extension that renders ` ```fsl ` / ` ```jssm ` fenced code blocks in the Markdown *preview* as live, interactive FSL state machines (the full `<fsl-instance>` IDE, minus the editor), per Layer 2 of the approved fence-convention spec.

**Architecture:** Two bundles from one repo. The **extension-host bundle** (Node) contributes a markdown-it plugin via `extendMarkdownIt` that replaces FSL fences with an escaped placeholder `<div class="fsl-fence">` and, **host-side** (Node, no webview CSP), renders each machine to SVG through jssm's Graphviz pipeline (`fsl_to_svg_string` from `jssm/viz`). Renders are cached in an LRU keyed by `(source, width, height)`; markdown-it fence rendering stays synchronous, so a cache **miss** emits the escaped-source placeholder and enqueues an async render, and each completed render triggers the built-in `markdown.preview.refresh` command so the next render pass inlines the now-cached SVG. (The Task 2 spike proved the Markdown-preview CSP blocks WebAssembly — `@viz-js/viz` cannot instantiate in the webview — so Graphviz runs in the host instead; see `notes/spikes/2026-07-02-wasm-under-preview-csp.md`.) The **preview bundle** (browser, contributed via `markdown.previewScripts`) registers jssm's web components and *hydrates* each placeholder into a live `<fsl-instance>` composition built **around** that pre-rendered SVG: the webview never lays out a graph, it only drives state highlighting on the static SVG as the machine transitions. jssm and lit are bundled into the preview script by esbuild (jssm's widget suite statically imports the viz pipeline, so `@viz-js/viz` rides along, but the webview never instantiates Graphviz for the primary diagram — only viz-dependent widget actions such as Export→SVG would, and those stay inert under the CSP); the Graphviz WASM is exercised only in the host bundle. No CDN, no import maps, works offline.

**Tech Stack:** TypeScript 5 (strict), esbuild, vitest + jsdom, markdown-it 14 (dev; VS Code supplies the runtime instance), `jssm@^5.157.0`, `lit@^3`, `@viz-js/viz@^3`, `@vscode/vsce`.

**Spec of record:** `notes/superpowers/specs/2026-06-23-fsl-markdown-fence-convention-design.md` in the jssm repo (§5 = this extension; §5.2 interpretation policy; §5.6 implementation concerns). A copy is checked into this repo at `notes/superpowers/specs/2026-06-23-fsl-markdown-fence-convention-design.md` by Task 1.

## Global Constraints

- **Interpretation policy (spec §5.2):** ignore all element/format tokens; ALWAYS render the full live IDE **less the `editor`** (viz + actions + toolbar + title + footer); HONOR `width=` / `height=`. (info-panel is HELD OUT of 0.1.0 by user ruling 2026-07-03 — jssm 5.157.x does not ship `fsl-info-panel`; the slot returns when a jssm release ships it. Deliberate deviation from spec §5.2, detailed in Task 5.)
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

### Task 3: Host-side render pipeline + the markdown-it fence plugin (pure)

The webview cannot run Graphviz (Task 2: WASM is CSP-blocked), so the *initial* SVG is rendered **host-side** in Node and inlined into the placeholder. This task builds three pure, vitest-covered modules — a render-cache primitive, the Node render call, and the (still-synchronous, still-pure) fence plugin — none of which import `'vscode'`. The thin `vscode` wiring that connects them (cache + async queue + `markdown.preview.refresh`) is Task 4.

**Files:**
- Create: `src/svg_cache.ts` (hash + LRU — pure)
- Create: `src/render_machine.ts` (async host-side FSL→SVG — pure, node-testable)
- Create: `src/fence_plugin.ts`
- Test: `src/tests/svg_cache.spec.ts`, `src/tests/render_machine.spec.ts`, `src/tests/fence_plugin.spec.ts`

**Interfaces:**
- Consumes: `fsl_fence_lang(info: string): 'fsl' | 'jssm' | null`, `parse_fence_info(info: string): FenceDescriptor`, `FenceDimension { value: number; unit: 'px' | 'percent' }` from `jssm`; `fsl_to_svg_string(fsl: string, opts?): Promise<string>` from `jssm/viz` (verified `node_modules/jssm/jssm_viz.es6.d.ts:4318` — resolves to SVG XML, rejects on unparseable FSL).
- Produces:
  - `fnv1a(text): string`, `svg_cache_key(source, width, height): string`, `class LruCache` — from `svg_cache.ts`.
  - `render_fsl_svg(source, opts?): Promise<string>` — from `render_machine.ts`.
  - `fsl_fence_plugin(md, { get_svg }): void`, `dimension_to_css(dim): string`, types `GetSvg` / `FslFencePluginOptions` — from `fence_plugin.ts`.
- **Injected sync lookup (purity boundary, decision #1):** `get_svg(source: string, desc: FenceDescriptor): string | null` returns cached host-rendered SVG markup, or `null` on a miss. The plugin never awaits and never imports `'vscode'`; the enqueue-on-miss side effect lives entirely inside the injected implementation (Task 4).
- **Emitted placeholder shape (Tasks 4–7 rely on it) — extend, don't replace.** The `.fsl-fence` div always carries `data-width`/`data-height` and the escaped `.fsl-fence-source` pre/code (graceful degradation + the error path). On a cache **hit** an extra `.fsl-fence-svg` child carries the host SVG **before** the source pre:
  - miss: `<div class="fsl-fence" data-width="300px" data-height=""><pre class="fsl-fence-source"><code>ESCAPED</code></pre></div>`
  - hit:  `<div class="fsl-fence" …><div class="fsl-fence-svg"><svg …>…</svg></div><pre class="fsl-fence-source"><code>ESCAPED</code></pre></div>`
- **Security (Global Constraints):** the source is ALWAYS `md.utils.escapeHtml`-escaped; the `.fsl-fence-svg` markup is inlined raw because its sole provenance is jssm/viz output (the same SVG `<fsl-viz>` would have injected in-webview).

- [ ] **Step 1: write the failing tests**

`src/tests/svg_cache.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { fnv1a, svg_cache_key, LruCache } from '../svg_cache.js';

describe('fnv1a', () => {

  it('is deterministic and 8 lowercase hex chars', () => {
    expect(fnv1a('a -> b;')).toBe(fnv1a('a -> b;'));
    expect(fnv1a('a -> b;')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('distinguishes different inputs', () => {
    expect(fnv1a('a -> b;')).not.toBe(fnv1a('a -> c;'));
  });

});

describe('svg_cache_key', () => {

  it('varies with source, width, and height independently', () => {
    const base = svg_cache_key('a -> b;', '', '');
    expect(svg_cache_key('a -> c;', '',      '')).not.toBe(base);
    expect(svg_cache_key('a -> b;', '300px', '')).not.toBe(base);
    expect(svg_cache_key('a -> b;', '',  '50%')).not.toBe(base);
  });

  it('is stable for identical (source, width, height)', () => {
    expect(svg_cache_key('a -> b;', '300px', '50%')).toBe(svg_cache_key('a -> b;', '300px', '50%'));
  });

});

describe('LruCache', () => {

  it('rejects a non-positive capacity', () => {
    expect(() => new LruCache(0)).toThrow(RangeError);
  });

  it('stores and retrieves', () => {
    const c = new LruCache(2);
    c.set('a', '1');
    expect(c.get('a')).toBe('1');
    expect(c.get('missing')).toBeNull();
  });

  it('evicts the least-recently-used entry past capacity', () => {
    const c = new LruCache(2);
    c.set('a', '1');
    c.set('b', '2');
    c.set('c', '3');           // 'a' is LRU → evicted
    expect(c.has('a')).toBe(false);
    expect(c.has('b')).toBe(true);
    expect(c.has('c')).toBe(true);
  });

  it('get promotes an entry so it survives the next eviction', () => {
    const c = new LruCache(2);
    c.set('a', '1');
    c.set('b', '2');
    expect(c.get('a')).toBe('1'); // 'a' now most-recent; 'b' is LRU
    c.set('c', '3');              // evicts 'b', not 'a'
    expect(c.has('a')).toBe(true);
    expect(c.has('b')).toBe(false);
  });

});
```

`src/tests/render_machine.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { render_fsl_svg } from '../render_machine.js';

describe('render_fsl_svg', () => {

  it('renders valid FSL to an SVG string (Node, no CSP)', async () => {
    const svg = await render_fsl_svg('a -> b;');
    expect(svg).toContain('<svg');
  });

  it('rejects on unparseable FSL so the caller can surface the error', async () => {
    await expect(render_fsl_svg('this is not -> valid ->;')).rejects.toThrow();
  });

});
```

`src/tests/fence_plugin.spec.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import MarkdownIt                   from 'markdown-it';
import { fsl_fence_plugin, dimension_to_css } from '../fence_plugin.js';
import type { GetSvg } from '../fence_plugin.js';

/** Build a markdown-it with the plugin wired to a fixed get_svg (default: all misses). */
const make_md = (get_svg: GetSvg = () => null): MarkdownIt => {
  const m = new MarkdownIt();
  fsl_fence_plugin(m, { get_svg });
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

  it('renders a cache MISS as a placeholder with escaped source and no SVG', () => {
    const html = make_md().render('```fsl\na -> b;\n```\n');
    expect(html).toContain('class="fsl-fence"');
    expect(html).toContain('fsl-fence-source');
    expect(html).toContain('a -&gt; b;');
    expect(html).not.toContain('fsl-fence-svg');
  });

  it('inlines the SVG BEFORE the source pre on a cache HIT', () => {
    const html = make_md(() => '<svg data-test="ok"></svg>').render('```fsl\na -> b;\n```\n');
    expect(html).toContain('class="fsl-fence-svg"');
    expect(html).toContain('<svg data-test="ok">');
    expect(html.indexOf('fsl-fence-svg')).toBeLessThan(html.indexOf('fsl-fence-source'));
  });

  it('passes the raw (unescaped) source and the parsed descriptor to get_svg', () => {
    const get_svg = vi.fn<GetSvg>(() => null);
    make_md(get_svg).render('```fsl width=300\na -> b;\n```\n');
    expect(get_svg).toHaveBeenCalledOnce();
    const [source, desc] = get_svg.mock.calls[0]!;
    expect(source).toBe('a -> b;\n');
    expect(desc.width).toEqual({ value: 300, unit: 'px' });
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

Run: `npx vitest run src/tests/svg_cache.spec.ts src/tests/render_machine.spec.ts src/tests/fence_plugin.spec.ts`
Expected: FAIL — `Cannot find module '../svg_cache.js'` (and the two siblings).

- [ ] **Step 3: implement**

`src/svg_cache.ts`:

```typescript
/**
 *  Deterministic cache key + a bounded LRU for host-rendered fence SVGs.
 *  Pure and dependency-free, so it unit-tests in plain node vitest.
 */

/**
 *  FNV-1a 32-bit hash of a string as an 8-char lowercase hex string.
 *  Deterministic and well-distributed enough to key a render cache; NOT
 *  cryptographic.  `Math.imul` keeps the multiply in 32-bit space.
 *
 *  @example
 *  fnv1a('a -> b;') === fnv1a('a -> b;');  // true (stable)
 */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 *  Cache key for one fence render: a hash of `(source, width, height)` so two
 *  fences with identical source but different dimensions never collide.  (The
 *  host SVG is itself dimension-independent — width/height are CSS applied
 *  later on the instance — but keying on them exactly as the spec states is
 *  the conservative choice.)  A NUL separator keeps the fields unambiguous.
 *
 *  @example
 *  svg_cache_key('a -> b;', '300px', '');  // 'fsl-…'
 */
export function svg_cache_key(source: string, width: string, height: string): string {
  return `fsl-${fnv1a(`${width}\u0000${height}\u0000${source}`)}`;
}

/**
 *  Fixed-capacity least-recently-used string cache.  `get` promotes the key to
 *  most-recent and returns `null` on a miss; `set` inserts/promotes and, once
 *  `capacity` is exceeded, evicts the single least-recently-used entry
 *  (Map preserves insertion order, so its first key is the LRU one).
 *
 *  @example
 *  const c = new LruCache(2);
 *  c.set('a', '1'); c.set('b', '2'); c.get('a'); c.set('c', '3');
 *  c.has('b');  // false — 'b' was least-recently-used and got evicted
 *
 *  @throws RangeError when `capacity` is not a positive integer.
 */
export class LruCache {

  readonly #capacity: number;
  readonly #map = new Map<string, string>();

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`LruCache capacity must be a positive integer, got ${capacity}`);
    }
    this.#capacity = capacity;
  }

  /** True when `key` is present (without promoting it). */
  has(key: string): boolean { return this.#map.has(key); }

  /** Value for `key`, promoted to most-recent, or `null` on a miss. */
  get(key: string): string | null {
    const value = this.#map.get(key);
    if (value === undefined) { return null; }
    this.#map.delete(key);
    this.#map.set(key, value);
    return value;
  }

  /** Insert or update `key`, promoting it and evicting the LRU entry if full. */
  set(key: string, value: string): void {
    this.#map.delete(key);
    this.#map.set(key, value);
    while (this.#map.size > this.#capacity) {
      const oldest = this.#map.keys().next().value as string;
      this.#map.delete(oldest);
    }
  }

  /** Number of entries currently held. */
  get size(): number { return this.#map.size; }

}
```

`src/render_machine.ts`:

```typescript
import { fsl_to_svg_string } from 'jssm/viz';

/** Optional Graphviz render flags — only the engine override is surfaced here. */
export interface RenderOpts {
  /** Graphviz layout engine (e.g. `'dot'`, `'neato'`, `'circo'`). */
  engine?: string;
}

/**
 *  Render FSL source to an SVG string **host-side** (Node, no browser CSP).
 *  Delegates to jssm's headless viz pipeline (`fsl_to_svg_string`, which runs
 *  Graphviz WASM — proven to work in Node by the Task 2 spike).  Rejects when
 *  the source fails to parse or lay out, so the caller caches nothing and the
 *  hydrator surfaces the parse error instead of a broken diagram.
 *
 *  The output is the raw pipeline SVG.  (`<fsl-viz>` additionally reorders the
 *  paint stack via a private, un-exported helper for edge-label layering; we
 *  do not depend on that internal, and our highlighting targets state *nodes*,
 *  which the reorder does not affect — see Task 5.)
 *
 *  @param source FSL machine source (the fence body).
 *  @param opts   Optional engine override.
 *  @returns A promise resolving to SVG XML.
 *  @throws When `source` is not valid FSL, or Graphviz fails to lay it out.
 *
 *  @example
 *  const svg = await render_fsl_svg('a -> b;');
 *  svg.includes('<svg');  // true
 */
export async function render_fsl_svg(source: string, opts?: RenderOpts): Promise<string> {
  return fsl_to_svg_string(source, opts);
}
```

Implementation note (verify in Task 8): `render_machine.ts` pulls `@viz-js/viz` into the **extension-host** bundle. esbuild bundles this for `platform: 'node'`; if the WASM asset does not inline cleanly into the Node CJS bundle, mark `@viz-js/viz` external in the host build and ship it in the VSIX — but do NOT touch Task 1's build script speculatively; confirm the bundle first (Task 8, Step 1).

`src/fence_plugin.ts`:

```typescript
import type MarkdownIt from 'markdown-it';
import { fsl_fence_lang, parse_fence_info } from 'jssm';
import type { FenceDescriptor, FenceDimension } from 'jssm';

/**
 *  Synchronous cached-SVG lookup injected into {@link fsl_fence_plugin}.
 *  Returns ready host-rendered SVG markup for a fence, or `null` on a miss.
 *  An implementation MAY, as a side effect of returning `null`, enqueue an
 *  async host render and later trigger a preview refresh (see extension.ts) —
 *  but this function itself is synchronous and side-effect-free from the
 *  plugin's point of view.
 */
export type GetSvg = (source: string, desc: FenceDescriptor) => string | null;

/** Options bag for {@link fsl_fence_plugin}. */
export interface FslFencePluginOptions {
  /** Synchronous cached-SVG lookup; see {@link GetSvg}. */
  get_svg: GetSvg;
}

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
 *  markdown-it plugin: replaces ```fsl / ```jssm fences with a hydration
 *  placeholder.  The `.fsl-fence` div always carries width/height data
 *  attributes and the HTML-escaped FSL source in a `.fsl-fence-source`
 *  pre/code (the graceful-degradation view, and the error path).  On a cache
 *  HIT — `get_svg` returns markup — the host-rendered SVG is additionally
 *  inlined in a `.fsl-fence-svg` child BEFORE the source pre; on a MISS the
 *  placeholder ships source-only and the injected `get_svg` enqueues the
 *  render.  All other fences fall through to the previous fence renderer.
 *
 *  Stays pure and synchronous: no `'vscode'` import, no `await`.  Per spec
 *  §5.2 element/format tokens are ignored; only width/height survive.
 *
 *  Security: `token.content` is always `escapeHtml`-escaped; the `get_svg`
 *  markup is inlined raw because its only source is jssm/viz output (the very
 *  SVG `<fsl-viz>` would have injected in-webview).
 *
 *  @example
 *  const md = new MarkdownIt();
 *  fsl_fence_plugin(md, { get_svg: (src, desc) => cache.lookup(src, desc) });
 *  md.render('```fsl width=300\na -> b;\n```\n');
 *  // '<div class="fsl-fence" data-width="300px" data-height="">…'
 */
export function fsl_fence_plugin(md: MarkdownIt, options: FslFencePluginOptions): void {

  const { get_svg } = options;
  const prior = md.renderer.rules.fence;

  md.renderer.rules.fence = function (tokens, idx, opts, env, self): string {

    const token = tokens[idx];
    if (token === undefined) { return ''; }

    const info = token.info ?? '';
    if (fsl_fence_lang(info) === null) {
      return prior !== undefined
        ? prior.call(this, tokens, idx, opts, env, self)
        : self.renderToken(tokens, idx, opts);
    }

    const desc = parse_fence_info(info);
    const esc  = md.utils.escapeHtml;

    const svg       = get_svg(token.content, desc);   // trusted jssm/viz markup, or null
    const svg_block = svg === null ? '' : `<div class="fsl-fence-svg">${svg}</div>`;

    return `<div class="fsl-fence" data-width="${esc(dimension_to_css(desc.width))}"`
         + ` data-height="${esc(dimension_to_css(desc.height))}">`
         + svg_block
         + `<pre class="fsl-fence-source"><code>${esc(token.content)}</code></pre>`
         + `</div>\n`;
  };

}
```

- [ ] **Step 4: run to verify pass**

Run: `npx vitest run src/tests/svg_cache.spec.ts src/tests/render_machine.spec.ts src/tests/fence_plugin.spec.ts`
Expected: PASS (svg_cache 8, render_machine 2, fence_plugin 10 = 20 tests).

- [ ] **Step 5: commit**

```bash
git add src/svg_cache.ts src/render_machine.ts src/fence_plugin.ts src/tests/svg_cache.spec.ts src/tests/render_machine.spec.ts src/tests/fence_plugin.spec.ts
git commit -m "feat: host-side SVG render pipeline (cache + render) and fence plugin with injected SVG lookup"
```

---

### Task 4: Extension entry — render queue + `extendMarkdownIt` wiring

The async render bridge lives here (decision #1). To keep it testable, the **queue** (cache + dedupe + enqueue + "ready" callback) is a pure, injectable module (`render_queue.ts`, node-tested); the **only** `vscode`-touching code is the thin debounced `markdown.preview.refresh` trigger in `extension.ts`, and `'vscode'` is imported *lazily* inside that trigger so the module still loads under vitest. The queue+debounce+refresh loop is exercised end-to-end only in Task 8 (the webview isn't reachable from vitest); the queue's cache/dedupe/error semantics are covered by unit tests.

**Files:**
- Create: `src/render_queue.ts` (pure, injectable)
- Modify: `src/extension.ts`
- Test: `src/tests/render_queue.spec.ts`, `src/tests/extension.spec.ts`

**Interfaces:**
- Consumes: `LruCache` / `svg_cache_key` (Task 3), `dimension_to_css` (Task 3), `render_fsl_svg` (Task 3), `fsl_fence_plugin` (Task 3).
- Produces:
  - `create_render_queue(deps): RenderQueue` where `RenderQueue.get_svg` has the {@link GetSvg} shape — from `render_queue.ts`.
  - `activate(): { extendMarkdownIt(md: MarkdownIt): MarkdownIt }` — the shape VS Code's built-in Markdown extension expects.

- [ ] **Step 1: write the failing tests**

`src/tests/render_queue.spec.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { create_render_queue } from '../render_queue.js';
import type { FenceDescriptor } from 'jssm';

/** Minimal descriptor with no dimensions. */
const desc = (): FenceDescriptor =>
  ({ parts: [], ide: true, format: 'svg', width: null, height: null, interactive: true, notes: [] }) as unknown as FenceDescriptor;

/** Let queued microtasks settle. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('create_render_queue', () => {

  it('returns null on first miss, renders once, then serves the cached SVG', async () => {
    const render   = vi.fn(async () => '<svg data-ok="1"></svg>');
    const on_ready = vi.fn();
    const q = create_render_queue({ render, on_ready });

    expect(q.get_svg('a -> b;', desc())).toBeNull(); // miss → enqueue
    await flush();
    expect(render).toHaveBeenCalledOnce();
    expect(on_ready).toHaveBeenCalledOnce();
    expect(q.get_svg('a -> b;', desc())).toBe('<svg data-ok="1"></svg>'); // hit
  });

  it('deduplicates concurrent misses for the same key (renders once)', async () => {
    const render = vi.fn(async () => '<svg/>');
    const q = create_render_queue({ render, on_ready: () => {} });
    q.get_svg('a -> b;', desc());
    q.get_svg('a -> b;', desc());
    await flush();
    expect(render).toHaveBeenCalledOnce();
  });

  it('swallows a render rejection: stays null, never fires on_ready, does not throw', async () => {
    const render   = vi.fn(async () => { throw new Error('bad fsl'); });
    const on_ready = vi.fn();
    const q = create_render_queue({ render, on_ready });
    expect(q.get_svg('bad', desc())).toBeNull();
    await flush();
    expect(on_ready).not.toHaveBeenCalled();
    expect(q.get_svg('bad', desc())).toBeNull();
  });

});
```

`src/tests/extension.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import MarkdownIt              from 'markdown-it';
import { activate }            from '../extension.js';

describe('activate', () => {

  it('returns an extendMarkdownIt that installs the fsl fence rule', () => {
    const md = activate().extendMarkdownIt(new MarkdownIt());
    // Cache is empty on first render, so the fence is the source-only placeholder.
    expect(md.render('```fsl\na -> b;\n```\n')).toContain('class="fsl-fence"');
  });

  it('returns the same markdown-it instance it was given', () => {
    const md = new MarkdownIt();
    expect(activate().extendMarkdownIt(md)).toBe(md);
  });

});
```

- [ ] **Step 2: run to verify failure**

Run: `npx vitest run src/tests/render_queue.spec.ts src/tests/extension.spec.ts`
Expected: FAIL — `Cannot find module '../render_queue.js'`; the stub's `extendMarkdownIt` doesn't install the rule.

- [ ] **Step 3: implement the queue**

`src/render_queue.ts`:

```typescript
import { LruCache, svg_cache_key } from './svg_cache.js';
import { dimension_to_css }        from './fence_plugin.js';
import type { GetSvg }             from './fence_plugin.js';
import type { FenceDescriptor }    from 'jssm';

/** Dependencies injected into {@link create_render_queue} (all testable fakes). */
export interface RenderQueueDeps {
  /** Host-side async render (FSL source → SVG). A rejection means the source is
   *  unrenderable; the queue caches nothing and never retries that key (the
   *  hydrator surfaces the parse error instead). */
  render: (source: string) => Promise<string>;
  /** Invoked once per completed render, after the SVG lands in the cache, so
   *  the host can trigger a debounced preview refresh. */
  on_ready: () => void;
  /** LRU capacity. Defaults to 256 fences. */
  capacity?: number;
}

/** The queue surface consumed by {@link fsl_fence_plugin}. */
export interface RenderQueue {
  /** Synchronous cached-SVG lookup: returns cached SVG, or `null` after
   *  idempotently enqueuing a host render on a miss. */
  get_svg: GetSvg;
}

/**
 *  Build the render queue that backs `fsl_fence_plugin`'s `get_svg`.  A cache
 *  hit returns the SVG synchronously; a miss returns `null` and (once per key)
 *  enqueues `deps.render`, caching the result and calling `deps.on_ready` so
 *  the caller can refresh the preview.  Purely in-memory and vscode-free, so
 *  its cache/dedupe/error behavior is unit-tested with fake deps.
 *
 *  @example
 *  const q = create_render_queue({
 *    render:   render_fsl_svg,
 *    on_ready: () => void vscode.commands.executeCommand('markdown.preview.refresh'),
 *  });
 *  fsl_fence_plugin(md, { get_svg: q.get_svg });
 */
export function create_render_queue(deps: RenderQueueDeps): RenderQueue {

  const cache     = new LruCache(deps.capacity ?? 256);
  const attempted = new Set<string>();

  const get_svg: GetSvg = (source: string, desc: FenceDescriptor): string | null => {
    const key = svg_cache_key(source, dimension_to_css(desc.width), dimension_to_css(desc.height));
    const hit = cache.get(key);
    if (hit !== null) { return hit; }
    if (!attempted.has(key)) {
      attempted.add(key);
      void deps.render(source).then(
        (svg) => { cache.set(key, svg); deps.on_ready(); },
        ()    => { /* unrenderable: leave uncached; the hydrator shows the parse error */ },
      );
    }
    return null;
  };

  return { get_svg };
}
```

- [ ] **Step 4: implement the entry**

`src/extension.ts` (replaces the stub):

```typescript
import type MarkdownIt        from 'markdown-it';
import { fsl_fence_plugin }   from './fence_plugin.js';
import { render_fsl_svg }     from './render_machine.js';
import { create_render_queue } from './render_queue.js';

/** Debounce window before a completed host render triggers a preview refresh. */
const REFRESH_DEBOUNCE_MS = 120;

/**
 *  Build the "renders are ready" callback: a debounced trigger of the built-in
 *  `markdown.preview.refresh` command.  `'vscode'` is imported LAZILY (inside
 *  the timer) so this module still loads under vitest, where the host `vscode`
 *  module is absent — the import only resolves in the real extension host.
 *  Manually verified in Task 8 (the refresh loop isn't reachable from vitest).
 */
function make_refresh_trigger(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer !== undefined) { clearTimeout(timer); }
    timer = setTimeout(() => {
      void import('vscode')
        .then((v) => v.commands.executeCommand('markdown.preview.refresh'))
        .catch(() => { /* not in the extension host (e.g. tests) — nothing to refresh */ });
    }, REFRESH_DEBOUNCE_MS);
  };
}

/**
 *  VS Code activation hook.  Builds the host-side render queue and returns the
 *  markdown-it extension point; the built-in Markdown extension calls
 *  `extendMarkdownIt` once when building the preview renderer, and the plugin
 *  installed there rewrites fsl/jssm fences into hydration placeholders,
 *  inlining a cached host-rendered SVG as soon as one is available (see
 *  fence_plugin.ts / render_queue.ts).
 *
 *  @example
 *  const md = activate().extendMarkdownIt(new MarkdownIt());
 *  md.render('```fsl\na -> b;\n```\n');  // contains class="fsl-fence"
 */
export function activate(): { extendMarkdownIt(md: MarkdownIt): MarkdownIt } {
  const queue = create_render_queue({
    render:   render_fsl_svg,
    on_ready: make_refresh_trigger(),
  });
  return {
    extendMarkdownIt(md: MarkdownIt): MarkdownIt {
      fsl_fence_plugin(md, { get_svg: queue.get_svg });
      return md;
    },
  };
}

/** VS Code deactivation hook.  Nothing to release. */
export function deactivate(): void { /* nothing to release */ }
```

- [ ] **Step 5: run to verify pass**

Run: `npx vitest run src/tests/render_queue.spec.ts src/tests/extension.spec.ts`
Expected: PASS (render_queue 3, extension 2 = 5 tests).

- [ ] **Step 6: commit**

```bash
git add src/render_queue.ts src/extension.ts src/tests/render_queue.spec.ts src/tests/extension.spec.ts
git commit -m "feat: render queue + activate() wires host-side SVG cache and debounced preview refresh"
```

---

### Task 5: The hydrator (webview side, pure DOM) + highlight driver

Because `<fsl-viz>` cannot render under the preview CSP (Task 2) **and** exposes no way to adopt an external SVG (its `_svg` is a private Lit `@state()` with no setter/attribute/method, and both of its render paths call the WASM viz pipeline — verified `node_modules/jssm/dist/wc/viz.js:149-353, 509-517`), the fallback does **not** use `<fsl-viz>`. Instead the hydrator places the host-rendered SVG directly in the instance's `viz` slot and drives highlighting itself, subscribing to the instance's machine.

The mounted composition (Task 7 relies on the `fsl-instance` tag; Task 6 hooks the validation seam):

```html
<fsl-instance theme="light" style="width:…; height:…">
  <span slot="title">FSL machine</span>
  <div slot="viz" class="fsl-static-viz"><svg …>HOST-RENDERED</svg></div>
  <fsl-toolbar slot="toolbar" no-validate no-lint></fsl-toolbar>
  <fsl-actions slot="actions"></fsl-actions>
  <fsl-footer slot="footer"></fsl-footer>
  <script type="text/fsl">SOURCE</script>
</fsl-instance>
```

Design notes locked in (grounded in jssm 5.157.x source):
- **Pending vs ready.** The hydrator only mounts when the placeholder already carries a `.fsl-fence-svg` (host render landed). A fence without it is left as the escaped-source placeholder — the pre-render state, *no* "rendering…" chrome (decision, user-decided) — and is **not** marked hydrated, so the next `markdown.preview.refresh` pass (which re-inlines the now-cached SVG) hydrates it.
- **Viz slot carries the host SVG, not `<fsl-viz>`.** The already-parsed, trusted `<svg>` node is *moved* out of `.fsl-fence-svg` into a `.fsl-static-viz` div in the `viz` slot. No `innerHTML` of un-escaped content is ever read (Global Constraints) — the SVG node was parsed by the browser from host-produced, jssm/viz-provenance markup.
- **Highlighting** is driven by `src/preview/highlight.ts` (a pure re-implementation of `<fsl-viz>`'s node-matching, since that method only styles SVG inside fsl-viz's own shadow root — `node_modules/jssm/dist/wc/viz.js:412-472`): match the `.node` whose Graphviz `<title>` equals the state name, stroke its shapes, recolor its label.
- **Machine subscription** (verified `node_modules/jssm/dist/wc/instance.js`): `<fsl-instance>` builds its own `Machine` from the `<script type="text/fsl">` channel (`resolve_fsl_source`, 1038-1091); exposes a public `get machine()` (1318, throws if read before connection); the machine's current state is `machine.state()` (109); `machine.on('transition', cb)` returns an unsubscribe fn (206/230/235); the host re-fires `fsl-machine-rebuilt` on a live rebuild (1752). The wiring runs behind `customElements.whenDefined('fsl-instance')`, so it is inert in jsdom (no defines imported in unit tests) and is manually verified in Task 8; the pure `highlight.ts` functions are unit-tested directly.
- Source travels via the `<script type="text/fsl">` child — jssm's documented channel for FSL containing `<` or `&` (`resolve_fsl_source`, instance.js:1044-1051).
- **No `fsl-editor` child, ever** (spec §5.2 — VS Code *is* the editor).
- Toolbar gets `no-validate no-lint`: those buttons fire intents nothing in a preview fulfills.
- **Deliberate deviation from spec §5.2 (user ruling): no `info-panel` slot in 0.1.0.** jssm 5.157.6 does not register `fsl-info-panel` (no define module names it — verified: only `widgets.define` / `editor.define` / `docs.define` / `instance.define` / `viz.define` run `define_canonical`/`define_with_synonym`, and none names it; it appears only in tutorial content), so rather than ship an inert unknown element the slot is removed entirely for 0.1.0; it returns when a jssm release ships the component (tracked upstream in the jssm repo).
- Idempotence via a `data-fsl-hydrated` marker; in jsdom, custom elements don't upgrade — tests assert **structure**.

- [ ] **Step 1: write the failing tests**

`src/tests/highlight.spec.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { highlight_state, clear_highlights } from '../preview/highlight.js';

/** A two-node graphviz-shaped SVG (nodes titled 'a' and 'b'). */
function make_svg(): SVGElement {
  const holder = document.createElement('div');
  holder.innerHTML =
    '<svg><g class="graph">' +
    '<g class="node"><title>a</title><ellipse/></g>' +
    '<g class="node"><title>b</title><ellipse/></g>' +
    '</g></svg>';
  return holder.querySelector('svg')!;
}

describe('highlight_state', () => {

  it('strokes the matching state node and leaves others unstyled', () => {
    const svg = make_svg();
    highlight_state(svg, 'a', { color: '#2e7d32' });
    const [a, b] = [...svg.querySelectorAll('.node')];
    expect((a!.querySelector('ellipse') as SVGElement).style.stroke).toBe('#2e7d32');
    expect((b!.querySelector('ellipse') as SVGElement).style.stroke).toBe('');
  });

  it('moves the highlight when the state changes', () => {
    const svg = make_svg();
    highlight_state(svg, 'a');
    highlight_state(svg, 'b');
    const [a, b] = [...svg.querySelectorAll('.node')];
    expect((a!.querySelector('ellipse') as SVGElement).style.stroke).toBe('');
    expect((b!.querySelector('ellipse') as SVGElement).style.stroke).not.toBe('');
  });

  it('is a no-op for an unknown state', () => {
    const svg = make_svg();
    highlight_state(svg, 'nope');
    for (const e of svg.querySelectorAll('ellipse')) {
      expect((e as SVGElement).style.stroke).toBe('');
    }
  });

});

describe('clear_highlights', () => {

  it('removes every inline override it installed', () => {
    const svg = make_svg();
    highlight_state(svg, 'a');
    clear_highlights(svg);
    const a = svg.querySelector('.node ellipse') as SVGElement;
    expect(a.style.stroke).toBe('');
  });

});
```

`src/tests/hydrate.spec.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { hydrate_fence, hydrate_all } from '../preview/hydrate.js';

/** Build a placeholder div as fence_plugin emits it. Pass `svg` for a cache-hit
 *  fence (mounts) or `null` for a still-pending one (source-only). */
function make_fence(source: string, svg: string | null = '<svg><g class="node"><title>a</title><ellipse/></g></svg>', width = '', height = ''): HTMLElement {
  const div = document.createElement('div');
  div.className = 'fsl-fence';
  div.setAttribute('data-width',  width);
  div.setAttribute('data-height', height);
  if (svg !== null) {
    const holder = document.createElement('div');
    holder.className = 'fsl-fence-svg';
    holder.innerHTML = svg;
    div.appendChild(holder);
  }
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

  it('puts the host SVG in a .fsl-static-viz viz slot and mounts NO fsl-viz', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    const viz = fence.querySelector('div.fsl-static-viz[slot="viz"]');
    expect(viz).not.toBeNull();
    expect(viz!.querySelector('svg')).not.toBeNull();
    expect(fence.querySelector('fsl-viz')).toBeNull();
  });

  it('mounts toolbar, actions, and footer into their slots', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    for (const [tag, slot] of [
      ['fsl-toolbar', 'toolbar'], ['fsl-actions', 'actions'], ['fsl-footer', 'footer'],
    ]) {
      expect(fence.querySelector(`${tag}[slot="${slot}"]`), `${tag} missing`).not.toBeNull();
    }
  });

  it('mounts no info-panel (deliberate §5.2 deviation — jssm 5.157.x does not ship fsl-info-panel)', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    expect(fence.querySelector('fsl-info-panel')).toBeNull();
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
    const fence = make_fence('a -> b;', undefined, '300px', '50%');
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

  it('leaves a still-pending fence (no .fsl-fence-svg) unhydrated', () => {
    const fence = make_fence('a -> b;', null);
    hydrate_fence(fence);
    expect(fence.querySelector('fsl-instance')).toBeNull();
    expect(fence.hasAttribute('data-fsl-hydrated')).toBe(false);
    expect(fence.querySelector('.fsl-fence-source')).not.toBeNull();
  });

});

describe('hydrate_all', () => {

  it('hydrates every ready .fsl-fence under the root', () => {
    document.body.innerHTML = '';
    make_fence('a -> b;');
    make_fence('c -> d;');
    hydrate_all(document);
    expect(document.querySelectorAll('fsl-instance').length).toBe(2);
  });

});
```

- [ ] **Step 2: run to verify failure**

Run: `npx vitest run src/tests/highlight.spec.ts src/tests/hydrate.spec.ts`
Expected: FAIL — `Cannot find module '../preview/highlight.js'` / `'../preview/hydrate.js'`.

- [ ] **Step 3: implement the highlight driver**

`src/preview/highlight.ts`:

```typescript
/**
 *  Programmatic highlighting of a host-rendered Graphviz SVG — the fallback's
 *  substitute for `<fsl-viz>`'s internal `highlightTrace`, which only styles
 *  SVG living in fsl-viz's own shadow root and would re-run Graphviz WASM
 *  (blocked under the preview CSP).  Matches Graphviz's own `<title>`
 *  convention so behavior tracks the live component
 *  (`node_modules/jssm/dist/wc/viz.js:412-472`).
 */

/** Undo the `&#45;` / `&gt;` escaping Graphviz emits inside `<title>`. */
function unescape_title(title: string): string {
  return title.replace(/&#45;/g, '-').replace(/&gt;/g, '>').replace(/"/g, '');
}

/**
 *  Remove every inline fill/stroke/opacity override this module installs,
 *  restoring the SVG's own Graphviz presentation.  Safe on an un-highlighted
 *  SVG, before the first highlight, or on an empty container.
 *
 *  @example
 *  clear_highlights(document.querySelector('.fsl-static-viz')!);
 */
export function clear_highlights(root: Element): void {
  for (const el of root.querySelectorAll<SVGElement>('.node, .edge, .node *, .edge *')) {
    el.style.removeProperty('fill');
    el.style.removeProperty('stroke');
    el.style.removeProperty('opacity');
  }
}

/**
 *  Emphasize the current-state node by name: clears prior highlights, then
 *  strokes the `.node` whose Graphviz `<title>` equals `state` and recolors
 *  its label.  No-op for an unknown state or an empty SVG.  A single-state
 *  emphasis (not a trace) — a live preview only needs to show *where* the
 *  machine is now.
 *
 *  @param root    The rendered `<svg>` (or a container holding it).
 *  @param state   The machine's current state name (`machine.state()`).
 *  @param options `color` overrides the stroke/label color (default crimson).
 *
 *  @example
 *  highlight_state(vizDiv, 'Green', { color: '#2e7d32' });
 */
export function highlight_state(root: Element, state: string, options: { color?: string } = {}): void {
  clear_highlights(root);
  const color = options.color ?? '#b71c1c';
  for (const node of root.querySelectorAll<SVGGElement>('.node')) {
    const title_el = node.querySelector('title');
    const title    = title_el ? unescape_title(title_el.textContent ?? '') : '';
    if (title !== state) { continue; }
    for (const shape of node.querySelectorAll<SVGElement>('polygon, ellipse, path')) {
      shape.style.stroke      = color;
      shape.style.strokeWidth = '2px';
    }
    for (const text of node.querySelectorAll<SVGElement>('text')) {
      text.style.fill = color;
    }
  }
}
```

- [ ] **Step 4: implement the hydrator**

`src/preview/hydrate.ts`:

```typescript
import { highlight_state } from './highlight.js';

/** Marker attribute preventing double-hydration across preview re-renders. */
const HYDRATED = 'data-fsl-hydrated';

/** Slotted panels of the always-full-IDE composition (spec §5.2) — no editor;
 *  no `<fsl-viz>` (the host-rendered SVG fills the `viz` slot instead); and no
 *  `fsl-info-panel` for 0.1.0 (deliberate §5.2 deviation: jssm 5.157.x does not
 *  register the component — the slot returns when a jssm release ships it). */
const PANELS: ReadonlyArray<readonly [tag: string, slot: string]> = [
  ['fsl-toolbar', 'toolbar'],
  ['fsl-actions', 'actions'],
  ['fsl-footer',  'footer'],
];

/** Minimal structural view of `<fsl-instance>` the highlight wiring relies on
 *  after the element upgrades (see instance.js `get machine()` / `machine.on`). */
interface FslInstanceElement extends HTMLElement {
  machine: { state(): unknown; on(event: 'transition', cb: () => void): () => void };
}

/**
 *  Subscribe the static viz SVG to the instance's machine so the current state
 *  stays highlighted across transitions.  Deferred behind
 *  `customElements.whenDefined('fsl-instance')` so it is inert in jsdom (the
 *  component is never defined in unit tests) and only runs in the real webview.
 *  Subscriptions live for the preview's lifetime (fences are long-lived); a
 *  live rebuild swaps the machine, so we re-subscribe on `fsl-machine-rebuilt`.
 */
function wire_highlighting(instance: FslInstanceElement, viz: Element): void {
  void customElements.whenDefined('fsl-instance').then(() => {
    const paint = (): void => {
      try { highlight_state(viz, String(instance.machine.state())); }
      catch { /* machine not built yet / detached — nothing to paint */ }
    };
    const subscribe = (): void => {
      try { instance.machine.on('transition', paint); } catch { /* not ready */ }
    };
    subscribe();
    paint();
    instance.addEventListener('fsl-machine-rebuilt', () => { subscribe(); paint(); });
  });
}

/**
 *  Replace one *ready* `.fsl-fence` placeholder (one that already carries a
 *  host-rendered `.fsl-fence-svg`) with a live `<fsl-instance>` composition:
 *  the host SVG in the `viz` slot, plus toolbar + actions + footer
 *  (never an editor).  The FSL source travels in a `<script type="text/fsl">`
 *  child — jssm's safe channel for source containing `<` or `&`.  A fence with
 *  no `.fsl-fence-svg` yet is left as its escaped-source placeholder (the host
 *  render is still in flight; the next preview refresh hydrates it) and is NOT
 *  marked hydrated.  Idempotent for ready fences via `data-fsl-hydrated`.
 *
 *  @example
 *  hydrate_fence(document.querySelector('.fsl-fence')!);
 *  // a ready fence now contains <fsl-instance>…</fsl-instance>
 */
export function hydrate_fence(fence: HTMLElement): void {

  if (fence.hasAttribute(HYDRATED)) { return; }

  const doc    = fence.ownerDocument;
  const source = fence.querySelector('.fsl-fence-source')?.textContent ?? '';

  const svg_holder = fence.querySelector('.fsl-fence-svg');
  if (svg_holder === null) { return; }   // pending: host render not ready yet
  fence.setAttribute(HYDRATED, 'true');

  const instance = doc.createElement('fsl-instance') as FslInstanceElement;
  instance.setAttribute('theme', 'light');

  const width  = fence.getAttribute('data-width')  ?? '';
  const height = fence.getAttribute('data-height') ?? '';
  if (width  !== '') { instance.style.width  = width;  }
  if (height !== '') { instance.style.height = height; }

  const title = doc.createElement('span');
  title.setAttribute('slot', 'title');
  title.textContent = 'FSL machine';
  instance.appendChild(title);

  const viz = doc.createElement('div');
  viz.setAttribute('slot', 'viz');
  viz.className = 'fsl-static-viz';
  const svg_el = svg_holder.querySelector('svg');
  if (svg_el !== null) { viz.appendChild(svg_el); }   // move the trusted, parsed SVG node
  instance.appendChild(viz);

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

  wire_highlighting(instance, viz);

}

/**
 *  Hydrate every ready `.fsl-fence` placeholder under `root`.  Safe to call
 *  repeatedly (per-fence idempotence guard); pending fences are skipped and
 *  picked up on a later call after their SVG lands.
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

- [ ] **Step 5: run to verify pass**

Run: `npx vitest run src/tests/highlight.spec.ts src/tests/hydrate.spec.ts`
Expected: PASS (highlight 4, hydrate 10 = 14 tests).

- [ ] **Step 6: commit**

```bash
git add src/preview/highlight.ts src/preview/hydrate.ts src/tests/highlight.spec.ts src/tests/hydrate.spec.ts
git commit -m "feat: hydrator mounts fsl-instance around the host-rendered SVG and drives state highlighting"
```

---

### Task 6: Error box — invalid FSL renders visibly, never blank

**Files:**
- Modify: `src/preview/hydrate.ts`
- Test: `src/tests/hydrate_errors.spec.ts`

**Interfaces:**
- Consumes: `sm` tagged-template from `jssm` (constructing a machine is the validation — it throws with a message on bad source).
- Produces: on invalid source, `hydrate_fence` renders `<div class="fsl-error-box"><strong>FSL error</strong><pre>MESSAGE</pre></div>` **before** the still-visible escaped source, and mounts no instance (spec §4.9/§5.5).

**Error-seam decision (decision #6): the seam stays hydrator-side (option B).** With host-side rendering, invalid FSL *also* fails the host render — but `render_machine` simply rejects and `render_queue` caches nothing (Tasks 3/4), so an invalid fence never gains a `.fsl-fence-svg`. The hydrator remains the single user-facing error surface: it validates via `sm` *before* the pending/ready gate, so an invalid fence shows the error box immediately (even while a valid neighbor is still rendering, and even if the host never produces anything). This keeps the Global Constraint "visible error box, never blank, source stays visible" intact and unchanged from the original plan; only the *placement within* `hydrate_fence` moves (it now sits ahead of the `.fsl-fence-svg` gate added in Task 5, and owns setting `HYDRATED` on the error path).

Design note: validation constructs the machine once in the hydrator (cheap relative to a render); a valid-but-still-pending fence validates clean and simply waits for its SVG.

- [ ] **Step 1: write the failing tests**

`src/tests/hydrate_errors.spec.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { hydrate_fence } from '../preview/hydrate.js';

/** Placeholder as fence_plugin emits it. `svg` present ⇒ a ready (valid) fence. */
function make_fence(source: string, svg: string | null = null): HTMLElement {
  const div = document.createElement('div');
  div.className = 'fsl-fence';
  div.setAttribute('data-width', '');
  div.setAttribute('data-height', '');
  if (svg !== null) {
    const holder = document.createElement('div');
    holder.className = 'fsl-fence-svg';
    holder.innerHTML = svg;
    div.appendChild(holder);
  }
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

  it('renders a visible error box and mounts no instance (even with no host SVG)', () => {
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

  it('marks the invalid fence hydrated so it is not retried', () => {
    const fence = make_fence('this is not -> valid ->;');
    hydrate_fence(fence);
    hydrate_fence(fence);
    expect(fence.querySelectorAll('.fsl-error-box').length).toBe(1);
  });

  it('still mounts normally for valid, rendered FSL (regression)', () => {
    const fence = make_fence('a -> b;', '<svg><g class="node"><title>a</title><ellipse/></g></svg>');
    hydrate_fence(fence);
    expect(fence.querySelector('fsl-instance')).not.toBeNull();
    expect(fence.querySelector('.fsl-error-box')).toBeNull();
  });

});
```

- [ ] **Step 2: run to verify failure**

Run: `npx vitest run src/tests/hydrate_errors.spec.ts`
Expected: FAIL — no error box is rendered (invalid source currently just no-ops as "pending").

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

Then, inside `hydrate_fence`, immediately after the `source` is read and **before** the `svg_holder` pending gate, insert:

```typescript
  const error = validate_fsl(source);
  if (error !== null) {
    fence.setAttribute(HYDRATED, 'true');   // don't re-run on every preview update
    render_error_box(fence, error);
    return;
  }
```

(This sits ahead of the `.fsl-fence-svg` gate from Task 5, so an invalid fence surfaces its error even though it has no host SVG; the marker keeps a broken fence from re-validating on every refresh.)

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
- Consumes: `hydrate_all` (Task 5); jssm side-effect defines `jssm/wc/instance/define` (registers `<fsl-instance>` — verified `instance.define.js:62`) and `jssm/wc/widgets/define` (registers `<fsl-toolbar>`, `<fsl-actions>`, `<fsl-footer>`, and the rest of the light widget ring — verified `widgets.define.js:57-66`).
- Produces: `theme_for_body_classes(classList: DOMTokenList): 'light' | 'dark'` (pure, tested); the assembled preview entry (verified manually in Task 8 — webview behavior isn't reachable from vitest).

Design notes locked in:
- **No `<fsl-viz>` / `jssm/wc/viz/define` import** (fallback): the primary diagram is the host SVG (Task 5), not a live viz component. `widgets.js` still *statically* imports the viz pipeline for its Export/Stochastic actions, so `@viz-js/viz` remains in the preview bundle, but the webview never instantiates Graphviz for the primary render; any viz-dependent widget action (e.g. Export→SVG) stays inert under the CSP — acceptable for 0.1.0.
- **Theming of the host SVG is theme-fixed at render time.** The host renders each SVG once (Node), theme-agnostic and cache-keyed by `(source, width, height)` only — Graphviz bakes its own palette (dark strokes/text on a light ground) into the markup, and the webview never re-renders it. Chosen stance for 0.1.0: **accept the fixed light-palette SVG** and give `.fsl-static-viz` a solid white background so the diagram stays legible under a dark VS Code theme, while `<fsl-instance theme="…">` themes the surrounding IDE chrome (toolbar/panels via `--fsl-color-*`). A theme-reactive SVG (re-render per theme, or a CSS-filter/`currentColor` override) is deliberately deferred (would require re-keying the cache on theme and a host round-trip on every theme switch).
- VS Code marks the preview body with `vscode-light` / `vscode-dark` / `vscode-high-contrast` / `vscode-high-contrast-light` classes. `<fsl-instance theme="…">` accepts `'system' | 'light' | 'dark'`; the entry maps body classes to a concrete variant instead of `system`, because the webview's `prefers-color-scheme` tracks the OS, not the VS Code theme.
- The built-in Markdown preview dispatches `vscode.markdown.updateContent` on `window` when it re-renders the body — re-run `hydrate_all` and re-apply theme there. This is also where the render→refresh handshake completes: a fence that was pending on the previous pass now carries its host SVG and gets mounted (the `data-fsl-hydrated` guard keeps already-live fences untouched).
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
 *  every ready fsl fence placeholder (mounting the live IDE around the
 *  host-rendered SVG), keeps hydration current across preview re-renders
 *  (`vscode.markdown.updateContent` — where late-arriving host SVGs get
 *  mounted), and keeps the instances' theme in step with the VS Code theme.
 *  No `<fsl-viz>` / viz define is imported: the diagram is host-rendered.
 */
import 'jssm/wc/instance/define';
import 'jssm/wc/widgets/define';

import { hydrate_all }            from './hydrate.js';
import { theme_for_body_classes } from './theme.js';

/** Injected once: error-box styling, static-viz surface, and fence spacing. */
const STYLES = `
  .fsl-error-box { border: 2px solid #c53; border-radius: 4px; padding: 8px 12px; margin: 8px 0; }
  .fsl-error-box strong { color: #c53; display: block; margin-bottom: 4px; }
  .fsl-error-box pre { margin: 0; white-space: pre-wrap; }
  .fsl-fence { margin: 8px 0; }
  /* Host SVG is theme-fixed (Graphviz palette baked at render time); a solid
     light ground keeps it legible under a dark VS Code theme. */
  .fsl-static-viz { background: #ffffff; border-radius: 4px; padding: 4px; overflow: auto; }
  .fsl-static-viz svg { max-width: 100%; height: auto; }
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
- [ ] Fence first shows escaped source, then the SVG appears on its own (host render → auto preview refresh) — no manual refresh
- [ ] Diagram layout is static per render: transitions move only the highlight, never re-lay-out the graph
- [ ] Clicking an action button transitions the machine; the current-state highlight moves to the new node
- [ ] width=300 fence is 300px wide
- [ ] ```js fence still renders as a normal highlighted code block
- [ ] Broken fence shows the FSL error box with the source visible beneath (appears even before any host SVG)
- [ ] Editing the .md re-renders the preview; machines re-hydrate (no double-mount, no dead panels)
- [ ] Switching VS Code light/dark theme restyles the IDE chrome without reload (host SVG stays its fixed light palette on its white ground — expected)
- [ ] Two fsl fences in one document run independently
- [ ] No webview WASM/CSP error in the console — Graphviz runs host-side, not in the webview (Developer: Open Webview Developer Tools)
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
