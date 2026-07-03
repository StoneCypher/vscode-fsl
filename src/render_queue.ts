import { LruCache, svg_cache_key } from './svg_cache.js';
import { dimension_to_css }        from './fence_plugin.js';
import type { GetSvg }             from './fence_plugin.js';
import type { FenceDescriptor }    from 'jssm';

/**
 *  Dependencies injected into {@link create_render_queue} (all testable fakes).
 *
 *  @example
 *  const deps: RenderQueueDeps = { render: render_fsl_svg, on_ready: () => {} };
 */
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

/**
 *  The queue surface consumed by {@link fsl_fence_plugin}.
 *
 *  @example
 *  const queue: RenderQueue = create_render_queue({ render: render_fsl_svg, on_ready: () => {} });
 *  queue.get_svg('a -> b;', desc);  // null on a miss, cached SVG on a hit
 */
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
