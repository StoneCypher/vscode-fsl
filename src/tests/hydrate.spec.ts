// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { hydrate_fence, hydrate_all } from '../preview/hydrate.js';

/** Minimal machine double: {@link FakeMachine.state} answers the current
 *  state name, {@link FakeMachine.on} records the transition subscriber. */
class FakeMachine {
  constructor(private readonly name: string) {}
  state(): string { return this.name; }
  on(_event: 'transition', _cb: () => void): () => void { return () => {}; }
}

/** Stub `<fsl-instance>` whose `machine` getter throws until
 *  {@link StubFslInstance.machine} is assigned a {@link FakeMachine},
 *  simulating the real component's async machine build from its
 *  `<script type="text/fsl">` child. */
class StubFslInstance extends HTMLElement {
  #machine: FakeMachine | null = null;
  get machine(): FakeMachine {
    if (this.#machine === null) { throw new Error('machine not built yet'); }
    return this.#machine;
  }
  set machine(m: FakeMachine | null) { this.#machine = m; }
}

if (customElements.get('fsl-instance') === undefined) {
  customElements.define('fsl-instance', StubFslInstance);
}

/** Flush the microtask queue so `customElements.whenDefined(...).then(...)`
 *  callbacks queued during a synchronous call have run. */
async function flush_microtasks(): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

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

describe('wire_highlighting (exercised through hydrate_fence)', () => {

  afterEach(() => { vi.restoreAllMocks(); });

  it('stays silent when the machine is not built yet on the very first paint/subscribe', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    // The stub's #machine is never assigned, so `instance.machine` throws on
    // every access — including this first, expected-transient pair.
    await flush_microtasks();
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when the machine throws again after a real fsl-machine-rebuilt (post-initial regression)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fence = make_fence('a -> b;');
    hydrate_fence(fence);
    const instance = fence.querySelector('fsl-instance') as unknown as StubFslInstance;
    // Set the machine before the queued whenDefined().then() callback runs,
    // so the initial subscribe()/paint() pair succeeds and `ready` flips true.
    instance.machine = new FakeMachine('a');
    await flush_microtasks();
    expect(warn).not.toHaveBeenCalled();

    // Simulate a genuine post-rebuild regression (e.g. a jssm API break):
    // the machine is unreachable even though the component reports a rebuild.
    instance.machine = null;
    instance.dispatchEvent(new Event('fsl-machine-rebuilt'));
    expect(warn).toHaveBeenCalled();
    const messages = warn.mock.calls.map(call => String(call[0]));
    expect(messages.some(m => m.includes('subscribing'))).toBe(true);
    expect(messages.some(m => m.includes('painting'))).toBe(true);
  });

});
