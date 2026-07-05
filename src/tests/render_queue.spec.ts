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

  it('a rejected key is never retried: get_svg keeps returning null and render is not re-invoked', async () => {
    const render = vi.fn(async () => { throw new Error('bad fsl'); });
    const q = create_render_queue({ render, on_ready: () => {} });
    expect(q.get_svg('bad', desc())).toBeNull();
    await flush();
    expect(render).toHaveBeenCalledOnce();
    expect(q.get_svg('bad', desc())).toBeNull(); // second pass: must not re-enqueue
    await flush();
    expect(render).toHaveBeenCalledOnce(); // still just once
  });

  it('regression: a key evicted from the cache is re-enqueued on its next get_svg (not stuck null forever)', async () => {
    const render   = vi.fn(async (source: string) => `<svg data-src="${source}"></svg>`);
    const on_ready = vi.fn();
    const q = create_render_queue({ render, on_ready, capacity: 1 });

    // Render + cache key A.
    expect(q.get_svg('A', desc())).toBeNull();
    await flush();
    expect(render).toHaveBeenCalledTimes(1);
    expect(q.get_svg('A', desc())).toBe('<svg data-src="A"></svg>');

    // Render key B — capacity 1, so this evicts A from the LRU cache.
    expect(q.get_svg('B', desc())).toBeNull();
    await flush();
    expect(render).toHaveBeenCalledTimes(2);
    expect(q.get_svg('B', desc())).toBe('<svg data-src="B"></svg>');

    // A was evicted: the next get_svg(A) must re-enqueue a render for A,
    // not return null forever because A was already "attempted" once.
    expect(q.get_svg('A', desc())).toBeNull();
    await flush();
    expect(render).toHaveBeenCalledTimes(3);
    expect(render).toHaveBeenNthCalledWith(3, 'A');
    expect(q.get_svg('A', desc())).toBe('<svg data-src="A"></svg>');
  });

});
