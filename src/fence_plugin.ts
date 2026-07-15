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
 *
 *  @example
 *  const get_svg: GetSvg = (source, desc) =>
 *    cache.get(svg_cache_key(source, dimension_to_css(desc.width), dimension_to_css(desc.height))) ?? null;
 */
export type GetSvg = (source: string, desc: FenceDescriptor) => string | null;

/**
 *  Options bag for {@link fsl_fence_plugin}.
 *
 *  @example
 *  fsl_fence_plugin(md, { get_svg } satisfies FslFencePluginOptions);
 */
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
  return `${String(dim.value)}${dim.unit === 'percent' ? '%' : 'px'}`;
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

    const info = token.info;
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
