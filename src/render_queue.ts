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
   *  unrenderable: the key is added to a session-scoped `failed` set and
   *  `get_svg` never re-enqueues it — even if it is later evicted from the
   *  cache — so a broken fence doesn't re-render on every keystroke while the
   *  hydrator shows the parse error. See {@link create_render_queue} for how
   *  that suppression interacts with cache eviction. */
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
 *  hit returns the SVG synchronously (promoting it as most-recently-used); a
 *  miss enqueues `deps.render` at most once per key and returns `null` while
 *  the render is outstanding.  On success the SVG is cached and
 *  `deps.on_ready` fires so the caller can refresh the preview; on rejection
 *  the key is marked failed for the rest of the session (see below), the
 *  rejection reason is reported via `console.warn('[fsl] fence render
 *  failed:', err)` so a broken render is visible instead of silently
 *  swallowed, and `get_svg` keeps returning `null` for it, without ever
 *  calling `on_ready` or throwing.  Purely in-memory and vscode-free, so its
 *  cache/dedupe/eviction/error behavior is unit-tested with fake deps.
 *
 *  In-flight and failed keys are tracked in two sets *separate* from the LRU
 *  cache itself:
 *  - `pending` — keys with a render outstanding; deduplicates concurrent
 *    misses for the same key down to one `deps.render` call.  A key is
 *    removed from `pending` the instant its render settles (success or
 *    failure), regardless of outcome.
 *  - `failed` — keys whose render rejected; never retried for the life of
 *    this queue.  This is a deliberate, permanent suppression per session —
 *    it prevents re-render churn on a broken fence while the user is mid-edit
 *    — and it is never pruned. Its growth is bounded by the number of
 *    *distinct invalid* FSL sources typed during the session: only a
 *    rejection adds a key, so valid sources (which succeed and thereafter
 *    live only in the cache) never occupy a slot, and re-editing the same
 *    invalid source repeatedly does not grow it further (it's a `Set`).
 *
 *  Critically, *successful* keys are tracked only by cache membership — there
 *  is no separate "succeeded" set — so once the LRU cache evicts a key past
 *  `capacity`, that key is simply absent from `cache`, `pending`, and
 *  `failed` alike, and the next `get_svg` for it re-enqueues a fresh render
 *  exactly like a first-time miss. This is what makes eviction recovery
 *  automatic: there is no stale "already attempted" bit left over from before
 *  the eviction to block it.
 *
 *  @example
 *  const q = create_render_queue({
 *    render:   render_fsl_svg,
 *    on_ready: () => void vscode.commands.executeCommand('markdown.preview.refresh'),
 *  });
 *  fsl_fence_plugin(md, { get_svg: q.get_svg });
 *
 *  @example
 *  // Eviction recovery: capacity 1, so rendering B evicts A from the cache;
 *  // the next get_svg('A', …) re-enqueues A's render instead of returning
 *  // null forever.
 *  const q = create_render_queue({ render: render_fsl_svg, on_ready: () => {}, capacity: 1 });
 *  q.get_svg('a -> b;', desc);       // null, renders + caches 'a -> b;'
 *  q.get_svg('c -> d;', desc);       // null, renders + caches 'c -> d;', evicts 'a -> b;'
 *  q.get_svg('a -> b;', desc);       // null again — re-enqueued, not stuck
 */
export function create_render_queue(deps: RenderQueueDeps): RenderQueue {

  const cache   = new LruCache(deps.capacity ?? 256);
  const pending = new Set<string>();
  const failed  = new Set<string>();

  const get_svg: GetSvg = (source: string, desc: FenceDescriptor): string | null => {
    const key = svg_cache_key(source, dimension_to_css(desc.width), dimension_to_css(desc.height));
    const hit = cache.get(key);
    if (hit !== null) { return hit; }
    if (!pending.has(key) && !failed.has(key)) {
      pending.add(key);
      void deps.render(source).then(
        (svg) => { pending.delete(key); cache.set(key, svg); deps.on_ready(); },
        (err: unknown) => { pending.delete(key); failed.add(key); console.warn('[fsl] fence render failed:', err); /* unrenderable: suppress retries this session; the hydrator shows the parse error */ },
      ).catch(() => { /* defensive: a throw in the fulfilled handler above must never surface as an unhandled rejection */ });
    }
    return null;
  };

  return { get_svg };
}
