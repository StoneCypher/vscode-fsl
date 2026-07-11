/**
 *  Minimal ambient typings for `viz.js` v2, which ships no `.d.ts` of its own
 *  (importing it under this project's `strict` TypeScript config reports
 *  TS7016 "could not find a declaration file for module 'viz.js'").
 *
 *  Only the shapes `viz_asm_shim.ts` actually touches are declared — the
 *  `Viz` constructor's `{ Module, render }` option pair (opaque Emscripten
 *  internals from `viz.js/full.render.js`, typed `unknown` since nothing
 *  here calls them directly) and `renderString`. Nothing beyond that
 *  adapter boundary can leak `any`.
 *
 *  @see ./viz_asm_shim.ts for the only consumer of these types.
 */

declare module 'viz.js' {

  /**
   *  Render options accepted by {@link Viz.renderString}. Mirrors the two
   *  fields jssm's viz pipeline (`jssm/dist/jssm_viz.mjs`) ever sets:
   *  `format` (always `'svg'`) and an optional `engine` override.
   */
  export interface VizJsRenderOptions {
    /** Graphviz output format, e.g. `'svg'`. Defaults to `'svg'` in viz.js@2. */
    format?: string;
    /** Graphviz layout engine, e.g. `'dot'`, `'neato'`, `'circo'`. */
    engine?: string;
  }

  /**
   *  Constructor options for {@link Viz}: the asm.js Emscripten `Module`
   *  factory and `render` function pair exported by `viz.js/full.render.js`.
   *  Both are opaque from the outside — declared `unknown` rather than
   *  `any` so a caller can only pass them straight through, never operate
   *  on them.
   */
  export interface VizJsOptions {
    Module: unknown;
    render: unknown;
  }

  /**
   *  The viz.js@2 Graphviz renderer. Construct with
   *  `new Viz({ Module, render })` using the pair from
   *  `viz.js/full.render.js`.
   */
  export default class Viz {
    constructor(options: VizJsOptions);

    /**
     *  Renders `src` (Graphviz DOT source) and resolves to the rendered
     *  output as a string. The returned promise rejects when `src` fails
     *  to parse or lay out — after which, per viz.js@2's known quirk, this
     *  `Viz` instance's internal Emscripten heap is left unusable and a new
     *  instance must be constructed for the next render.
     */
    renderString(src: string, options?: VizJsRenderOptions): Promise<string>;
  }

}

declare module 'viz.js/full.render.js' {
  /** Opaque Emscripten module factory; passed straight to `new Viz(...)`. */
  export const Module: unknown;
  /** Opaque Emscripten render function; passed straight to `new Viz(...)`. */
  export const render: unknown;
}
