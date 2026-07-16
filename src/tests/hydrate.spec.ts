// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { hydrate_fence, hydrate_all } from '../preview/hydrate.js';

/**
 *  Stub `<fsl-viz>` with a real (open) shadow root, standing in for jssm's
 *  Lit-based component. The first-paint bridge (exercised only through
 *  {@link hydrate_fence} — it is not itself exported) watches this element's
 *  `shadowRoot` for an `<svg>` to appear; writing
 *  `<div class="container"><svg></svg></div>` into `shadowRoot` simulates
 *  the live component's own successful Graphviz render landing, without
 *  spinning up the real Lit component (slow/flaky per the task brief — this
 *  is a real, driven DOM mutation, not a fake/pre-baked assertion).
 */
class StubFslViz extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
}
if (customElements.get('fsl-viz') === undefined) {
  customElements.define('fsl-viz', StubFslViz);
}

/** Flush the microtask queue so a `MutationObserver` callback queued during a
 *  synchronous DOM mutation has run. */
async function flush_microtasks(): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

/** Build a placeholder div as fence_plugin emits it. Pass `svg` for a cache-hit
 *  fence (mounts) or `null` for a still-pending one (source-only). */
function make_fence(source: string, svg: string | null = '<svg><g class="node"><title>a</title><ellipse/></g></svg>', width = '', height = '', max_width = '', max_height = ''): HTMLElement {
  const div = document.createElement('div');
  div.className = 'fsl-fence';
  div.setAttribute('data-width',      width);
  div.setAttribute('data-height',     height);
  div.setAttribute('data-max-width',  max_width);
  div.setAttribute('data-max-height', max_height);
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

  it('mounts a live fsl-viz in the viz slot and no static viz-slot div', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    const viz = fence.querySelector('fsl-viz[slot="viz"]');
    expect(viz).not.toBeNull();
    expect(fence.querySelector('.fsl-static-viz')).toBeNull();
  });

  it('mounts toolbar, actions, footer, and info-panel into their slots', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    for (const [tag, slot] of [
      ['fsl-toolbar', 'toolbar'], ['fsl-actions', 'actions'], ['fsl-footer', 'footer'], ['fsl-info-panel', 'info-panel'],
    ]) {
      expect(fence.querySelector(`${tag}[slot="${slot}"]`), `${tag} missing`).not.toBeNull();
    }
  });

  it('mounts an info-panel into the info-panel slot', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    expect(fence.querySelector('fsl-info-panel[slot="info-panel"]')).not.toBeNull();
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

  it('marks the instance autoheight when no explicit height= is set', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    const instance = fence.querySelector('fsl-instance') as HTMLElement;
    expect(instance.classList.contains('fsl-autoheight')).toBe(true);
  });

  it('does not mark the instance autoheight when an explicit height= is set', () => {
    const fence = make_fence('a -> b;', undefined, '', '50%');
    hydrate_fence(fence);
    const instance = fence.querySelector('fsl-instance') as HTMLElement;
    expect(instance.classList.contains('fsl-autoheight')).toBe(false);
  });

  it('applies max-width to the instance style when width is absent', () => {
    const fence = make_fence('a -> b;', undefined, '', '', '400px');
    hydrate_fence(fence);
    const instance = fence.querySelector('fsl-instance') as HTMLElement;
    expect(instance.style.maxWidth).toBe('400px');
    expect(instance.style.width).toBe('');
  });

  it('does not apply max-width when an explicit width is set (exact wins)', () => {
    const fence = make_fence('a -> b;', undefined, '300px', '', '400px');
    hydrate_fence(fence);
    const instance = fence.querySelector('fsl-instance') as HTMLElement;
    expect(instance.style.width).toBe('300px');
    expect(instance.style.maxWidth).toBe('');
  });

  it('applies max-height and the --jssm-viz-max-height custom property to the viz element when height is absent', () => {
    const fence = make_fence('a -> b;', undefined, '', '', '', '400px');
    hydrate_fence(fence);
    const viz = fence.querySelector('fsl-viz[slot="viz"]') as HTMLElement;
    expect(viz.style.maxHeight).toBe('400px');
    expect(viz.style.getPropertyValue('--jssm-viz-max-height')).toBe('400px');
  });

  it('does not apply max-height when an explicit height is set (exact wins)', () => {
    const fence = make_fence('a -> b;', undefined, '', '50%', '', '400px');
    hydrate_fence(fence);
    const instance = fence.querySelector('fsl-instance') as HTMLElement;
    const viz = fence.querySelector('fsl-viz[slot="viz"]') as HTMLElement;
    expect(instance.style.height).toBe('50%');
    expect(viz.style.maxHeight).toBe('');
    expect(viz.style.getPropertyValue('--jssm-viz-max-height')).toBe('');
  });

  it('suppresses fsl-autoheight when max-height is set', () => {
    const fence = make_fence('a -> b;', undefined, '', '', '', '400px');
    hydrate_fence(fence);
    const instance = fence.querySelector('fsl-instance') as HTMLElement;
    expect(instance.classList.contains('fsl-autoheight')).toBe(false);
  });

  it('is idempotent — a second call does not double-mount', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    hydrate_fence(fence);
    expect(fence.querySelectorAll('fsl-instance').length).toBe(1);
    expect(fence.querySelectorAll('fsl-viz').length).toBe(1);
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

describe('first-paint bridge (exercised through hydrate_fence)', () => {

  it('keeps the host-rendered static SVG visible and the live instance hidden right after mount', () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    expect(fence.querySelector('.fsl-fence-svg')).not.toBeNull();
    const instance = fence.querySelector('fsl-instance') as HTMLElement;
    expect(instance.style.display).toBe('none');
  });

  it('swaps to the live viz once it paints a real svg, removing the static SVG and revealing the instance', async () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    const viz = fence.querySelector('fsl-viz') as HTMLElement;
    viz.shadowRoot!.innerHTML = '<div class="container"><svg></svg></div>';
    await flush_microtasks();
    expect(fence.querySelector('.fsl-fence-svg')).toBeNull();
    const instance = fence.querySelector('fsl-instance') as HTMLElement;
    expect(instance.style.display).toBe('');
  });

  it('does not swap while the shadow root has no svg yet', async () => {
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    const viz = fence.querySelector('fsl-viz') as HTMLElement;
    viz.shadowRoot!.innerHTML = '<div class="container"></div>';
    await flush_microtasks();
    expect(fence.querySelector('.fsl-fence-svg')).not.toBeNull();
    const instance = fence.querySelector('fsl-instance') as HTMLElement;
    expect(instance.style.display).toBe('none');
  });

});
