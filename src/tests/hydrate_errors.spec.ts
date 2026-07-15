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

  it('keeps showing the static SVG forever when fsl-viz never upgrades to a real custom element (no shadow root here)', () => {
    // This file never registers 'fsl-viz', so the mounted element is a plain,
    // un-upgraded HTMLElement with `shadowRoot === null` — the first-paint
    // bridge's bail-out branch. The fallback (never a silent blank, per
    // spec §4.9) is to leave the host-rendered static SVG in place forever.
    const fence = make_fence('a -> b;', '<svg><g class="node"><title>a</title><ellipse/></g></svg>');
    expect(() => { hydrate_fence(fence); }).not.toThrow();
    expect(fence.querySelector('.fsl-fence-svg')).not.toBeNull();
    const instance = fence.querySelector('fsl-instance') as HTMLElement;
    expect(instance.style.display).toBe('none');
  });

});
