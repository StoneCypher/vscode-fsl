/**
 *  Drop-in replacement for `@viz-js/viz`'s module surface, backed by
 *  viz.js@2's asm.js Graphviz build instead of `@viz-js/viz`'s WebAssembly
 *  one. Aliased over `'@viz-js/viz'` in the PREVIEW esbuild bundle only
 *  (`src/scripts/build.mjs`) because VS Code's markdown-preview webview CSP
 *  blocks WebAssembly instantiation but allows plain asm.js — proven by a
 *  user-verified spike (`build/csp_probe_entry.mjs`).
 *
 *  jssm's viz pipeline (`node_modules/jssm/dist/jssm_viz.mjs`) consumes
 *  exactly this much of `@viz-js/viz`:
 *
 *  ```js
 *  const mod = await import("@viz-js/viz");
 *  viz_instance = await mod.instance();
 *  // …later, per render:
 *  viz_instance.renderString(dot, Object.assign({ format: "svg" }, options))
 *  ```
 *
 *  This module reproduces that surface — an async {@link instance} factory
 *  resolving to an object with a `renderString(dot, options)` method — so
 *  esbuild's `alias` can substitute it wholesale with no changes to jssm.
 */
import Viz from 'viz.js';
import { Module, render } from 'viz.js/full.render.js';

/**
 *  Render options {@link VizAsmInstance.renderString} accepts. Matches the
 *  only fields jssm's viz pipeline ever sets: `format` (always `'svg'` in
 *  this codebase) and jssm's `dot_to_svg`-level `engine` override.
 */
export interface VizAsmRenderOptions {
  /** Graphviz output format, e.g. `'svg'`. */
  format?: string;
  /** Graphviz layout engine, e.g. `'dot'`, `'neato'`, `'circo'`. */
  engine?: string;
}

/**
 *  The `@viz-js/viz`-shaped handle {@link instance} resolves to. Wraps a
 *  viz.js@2 `Viz` object and transparently recreates it after a render
 *  error: viz.js@2's asm.js `Viz` instance is a thin wrapper around one
 *  Emscripten module instantiated once at construction, and a render that
 *  throws leaves that Emscripten heap in a state where every subsequent
 *  render — even of valid input — fails too. Rebuilding a fresh `Viz`
 *  (cheap: the asm.js module itself is already JIT-compiled by the engine)
 *  keeps one bad render from poisoning the rest of the session.
 */
export class VizAsmInstance {

  #viz: Viz = new Viz({ Module, render });

  /**
   *  Renders `dot` (Graphviz DOT source) and resolves to the rendered
   *  output — SVG markup when `options.format` is `'svg'`, the value jssm
   *  always supplies.
   *
   *  @param dot     Graphviz DOT source, e.g. `"digraph { a -> b; }"`.
   *  @param options Render options; jssm always passes `{ format: 'svg' }`
   *                 merged with any caller `engine` override.
   *  @returns The rendered output string.
   *  @throws When `dot` is not valid DOT syntax or Graphviz fails to lay it
   *  out. After throwing, this instance discards and rebuilds its
   *  underlying viz.js@2 engine so the *next* call starts from a fresh
   *  Emscripten heap instead of the one the failed render corrupted.
   *
   *  @example
   *  const viz = await instance();
   *  const svg = await viz.renderString('digraph { a -> b; }', { format: 'svg' });
   *  svg.includes('<svg');  // true
   */
  async renderString(dot: string, options?: VizAsmRenderOptions): Promise<string> {
    try {
      return await this.#viz.renderString(dot, options);
    } catch (error) {
      this.#viz = new Viz({ Module, render });
      throw error;
    }
  }

}

/**
 *  Resolves to a fresh {@link VizAsmInstance} — the async factory jssm's
 *  viz pipeline calls (as `mod.instance()`) in place of `@viz-js/viz`'s own
 *  `instance()` export.
 *
 *  @returns A promise resolving to an object with a `renderString` method.
 *
 *  @example
 *  const viz = await instance();
 *  const svg = await viz.renderString('digraph { a -> b; }', { format: 'svg' });
 */
export function instance(): Promise<VizAsmInstance> {
  return Promise.resolve(new VizAsmInstance());
}
