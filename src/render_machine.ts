import { fsl_to_svg_string } from 'jssm/viz';

/**
 *  Optional Graphviz render flags — only the engine override is surfaced here.
 *
 *  @example
 *  const opts: RenderOpts = { engine: 'dot' };
 */
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
 *  The output is the raw pipeline SVG, used only for the fence's first paint /
 *  graceful degradation.  (`<fsl-viz>` additionally reorders the paint stack
 *  via a private, un-exported helper for edge-label layering; we do not
 *  depend on that internal.)  The live diagram shown after first paint is a
 *  separate, self-rendering `<fsl-viz>` mounted in-webview (see
 *  `src/preview/hydrate.ts`), which re-renders itself on every transition and
 *  needs no support from this module.
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
