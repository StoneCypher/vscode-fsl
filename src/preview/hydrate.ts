import { highlight_state } from './highlight.js';

/** Marker attribute preventing double-hydration across preview re-renders. */
const HYDRATED = 'data-fsl-hydrated';

/** Slotted panels of the always-full-IDE composition (spec §5.2) — no editor;
 *  no `<fsl-viz>` (the host-rendered SVG fills the `viz` slot instead); and no
 *  `fsl-info-panel` for 0.1.0 (deliberate §5.2 deviation: jssm 5.157.x does not
 *  register the component — the slot returns when a jssm release ships it). */
const PANELS: readonly (readonly [tag: string, slot: string])[] = [
  ['fsl-toolbar', 'toolbar'],
  ['fsl-actions', 'actions'],
  ['fsl-footer',  'footer'],
];

/** Minimal structural view of `<fsl-instance>` the highlight wiring relies on
 *  after the element upgrades (see instance.js `get machine()` / `machine.on`). */
interface FslInstanceElement extends HTMLElement {
  machine: { state(): unknown; on(event: 'transition', cb: () => void): () => void };
}

/**
 *  Subscribe the static viz SVG to the instance's machine so the current state
 *  stays highlighted across transitions.  Deferred behind
 *  `customElements.whenDefined('fsl-instance')` so it is inert in jsdom (the
 *  component is never defined in unit tests) and only runs in the real webview.
 *  Subscriptions live for the preview's lifetime (fences are long-lived); a
 *  live rebuild swaps the machine, so we re-subscribe on `fsl-machine-rebuilt`.
 */
function wire_highlighting(instance: FslInstanceElement, viz: Element): void {
  void customElements.whenDefined('fsl-instance').then(() => {
    const paint = (): void => {
      try { highlight_state(viz, String(instance.machine.state())); }
      catch { /* machine not built yet / detached — nothing to paint */ }
    };
    const subscribe = (): void => {
      try { instance.machine.on('transition', paint); } catch { /* not ready */ }
    };
    subscribe();
    paint();
    instance.addEventListener('fsl-machine-rebuilt', () => { subscribe(); paint(); });
  });
}

/**
 *  Replace one *ready* `.fsl-fence` placeholder (one that already carries a
 *  host-rendered `.fsl-fence-svg`) with a live `<fsl-instance>` composition:
 *  the host SVG in the `viz` slot, plus toolbar + actions + footer
 *  (never an editor).  The FSL source travels in a `<script type="text/fsl">`
 *  child — jssm's safe channel for source containing `<` or `&`.  A fence with
 *  no `.fsl-fence-svg` yet is left as its escaped-source placeholder (the host
 *  render is still in flight; the next preview refresh hydrates it) and is NOT
 *  marked hydrated.  Idempotent for ready fences via `data-fsl-hydrated`.
 *
 *  @example
 *  hydrate_fence(document.querySelector('.fsl-fence')!);
 *  // a ready fence now contains <fsl-instance>…</fsl-instance>
 */
export function hydrate_fence(fence: HTMLElement): void {

  if (fence.hasAttribute(HYDRATED)) { return; }

  const doc    = fence.ownerDocument;
  const source = fence.querySelector('.fsl-fence-source')?.textContent ?? '';

  const svg_holder = fence.querySelector('.fsl-fence-svg');
  if (svg_holder === null) { return; }   // pending: host render not ready yet
  fence.setAttribute(HYDRATED, 'true');

  const instance = doc.createElement('fsl-instance') as FslInstanceElement;
  instance.setAttribute('theme', 'light');

  const width  = fence.getAttribute('data-width')  ?? '';
  const height = fence.getAttribute('data-height') ?? '';
  if (width  !== '') { instance.style.width  = width;  }
  if (height !== '') { instance.style.height = height; }

  const title = doc.createElement('span');
  title.setAttribute('slot', 'title');
  title.textContent = 'FSL machine';
  instance.appendChild(title);

  const viz = doc.createElement('div');
  viz.setAttribute('slot', 'viz');
  viz.className = 'fsl-static-viz';
  const svg_el = svg_holder.querySelector('svg');
  if (svg_el !== null) { viz.appendChild(svg_el); }   // move the trusted, parsed SVG node
  instance.appendChild(viz);

  for (const [tag, slot] of PANELS) {
    const el = doc.createElement(tag);
    el.setAttribute('slot', slot);
    if (tag === 'fsl-toolbar') {
      el.setAttribute('no-validate', '');
      el.setAttribute('no-lint', '');
    }
    instance.appendChild(el);
  }

  const script = doc.createElement('script');
  script.setAttribute('type', 'text/fsl');
  script.textContent = source;
  instance.appendChild(script);

  fence.replaceChildren(instance);

  wire_highlighting(instance, viz);

}

/**
 *  Hydrate every ready `.fsl-fence` placeholder under `root`.  Safe to call
 *  repeatedly (per-fence idempotence guard); pending fences are skipped and
 *  picked up on a later call after their SVG lands.
 *
 *  @example
 *  hydrate_all(document);
 */
export function hydrate_all(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>('.fsl-fence')) {
    hydrate_fence(el);
  }
}
