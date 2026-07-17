import { sm } from 'jssm';

/** Marker attribute preventing double-hydration across preview re-renders. */
const HYDRATED = 'data-fsl-hydrated';

/** Slotted panels of the always-full-IDE composition (spec §5.2) — no editor. */
const PANELS: readonly (readonly [tag: string, slot: string])[] = [
  ['fsl-toolbar',    'toolbar'],
  ['fsl-actions',    'actions'],
  ['fsl-footer',     'footer'],
  ['fsl-info-panel', 'info-panel'],
];

/**
 *  Validate FSL by constructing a machine; returns the error message on
 *  failure, `null` on success.  Constructing is the only complete
 *  validation — anything less accepts source the instance would choke on.
 *
 *  @example
 *  validate_fsl('a -> b;');   // null
 *  validate_fsl('a -> -> ;'); // 'jssm parse error: …'
 */
export function validate_fsl(source: string): string | null {
  try {
    void sm`${source}`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/**
 *  Prepend a visible error box (spec §4.9: never a silent blank) to a fence,
 *  leaving the escaped source visible beneath it.
 */
function render_error_box(fence: HTMLElement, message: string): void {
  const doc   = fence.ownerDocument;
  const box   = doc.createElement('div');
  box.className = 'fsl-error-box';
  const title = doc.createElement('strong');
  title.textContent = 'FSL error';
  const body  = doc.createElement('pre');
  body.textContent = message;
  box.append(title, body);
  fence.prepend(box);
}

/**
 *  Reveal `instance` (currently `display: none`) and drop the fence's
 *  host-rendered static SVG (`static_holder`) the instant the live `viz`
 *  element has painted real content into its own shadow DOM — the seam that
 *  hides Task 10a's ~1 s asm.js Graphviz warmup behind the already-visible
 *  static SVG instead of a blank pane.
 *
 *  `<fsl-viz>` publishes no "render succeeded" event — only a `viz-error`
 *  `CustomEvent` on failure (`node_modules/jssm/dist/wc/viz.js`,
 *  `_rerenderFromHostMachine`) — so there is no single first-class contract
 *  signal to await here. The least heuristic option actually available is a
 *  `MutationObserver` on the component's own shadow root (Lit's default
 *  `{ mode: 'open' }`, `node_modules/@lit/reactive-element/.../reactive-element.js`
 *  `createRenderRoot`): it fires the instant an `<svg>` lands under
 *  `.container`, the literal DOM effect a successful render produces
 *  (`viz.js` `render()`: `` html`<div class="container">${unsafeHTML(this._svg)}</div>` ``).
 *  This observes a real, standard DOM API (`Element.shadowRoot`) but infers
 *  success from Lit's rendering side effect rather than a documented event —
 *  flagged here as the honest answer, since no better contract exists today.
 *
 *  A render that fails (`viz-error`) is deliberately NOT special-cased: no
 *  mutation ever lands, so this simply never fires and the fence keeps
 *  showing the static SVG forever — spec §4.9's "never a silent blank"
 *  applies just as well to a failed live re-render as to a missing one.
 *
 *  Inert when `viz` never upgrades to a real custom element (`shadowRoot`
 *  stays `null` — e.g. a unit test that never defines `fsl-viz`, or a
 *  runtime without the component registered): the fence then keeps the
 *  static SVG forever, the same safe fallback.
 *
 *  If the fence (and with it `viz`'s shadow root) is removed from the
 *  document before the first paint lands, this observer is never explicitly
 *  disconnected — but once nothing references the removed nodes, the
 *  observer and its callback closure become garbage-collectable like any
 *  other DOM listener on a detached tree, and no callback can fire after
 *  removal in practice.
 *
 *  @example
 *  wire_first_paint_bridge(vizEl, instanceEl, staticSvgHolder);
 *  // staticSvgHolder stays visible / instanceEl stays display:none until
 *  // vizEl's shadow root gains a real <svg>, then they swap.
 */
function wire_first_paint_bridge(viz: Element, instance: HTMLElement, static_holder: Element): void {

  const has_painted = (root: ShadowRoot): boolean => root.querySelector('.container svg') !== null;

  const reveal = (): void => {
    static_holder.remove();
    instance.style.display = '';
  };

  const root = viz.shadowRoot;
  if (root === null) { return; }   // never upgraded to a real custom element

  if (has_painted(root)) { reveal(); return; }

  const observer = new MutationObserver(() => {
    if (has_painted(root)) { observer.disconnect(); reveal(); }
  });
  observer.observe(root, { childList: true, subtree: true });

}

/**
 *  Replace one *ready* `.fsl-fence` placeholder (one that already carries a
 *  host-rendered `.fsl-fence-svg`) with a live `<fsl-instance>` composition:
 *  an empty `<fsl-viz>` in the `viz` slot — which self-binds to the
 *  instance's own machine (`node_modules/jssm/dist/wc/viz.js`
 *  `connectedCallback`'s nested-mode path) and genuinely re-renders via
 *  Graphviz (Task 10a's in-webview asm.js engine) on every transition — plus
 *  toolbar + actions + info-panel + footer (never an editor).  The FSL source travels in
 *  a `<script type="text/fsl">` child — jssm's safe channel for source
 *  containing `<` or `&`.  A fence with no `.fsl-fence-svg` yet is left as
 *  its escaped-source placeholder (the host render is still in flight; the
 *  next preview refresh hydrates it) and is NOT marked hydrated. Idempotent
 *  for ready fences via `data-fsl-hydrated`.
 *
 *  Before any of that, the source is validated via {@link validate_fsl}. On
 *  invalid FSL — regardless of whether a host SVG is present — the fence
 *  gets a visible `.fsl-error-box` (spec §4.9: never a silent blank)
 *  prepended ahead of the still-visible escaped source, no `<fsl-instance>`
 *  is mounted, and the fence is marked hydrated so the error is not
 *  re-validated on every preview refresh.
 *
 *  First paint: the instance mounts `display: none` and the fence keeps
 *  showing its host-rendered `.fsl-fence-svg` until the live `<fsl-viz>`
 *  actually paints its own SVG; see {@link wire_first_paint_bridge} for the
 *  swap. This hides the asm.js engine's warmup behind the already-visible
 *  static SVG rather than a blank pane.
 *
 *  `data-width`/`data-height` (spec §5.2 — explicit fence tokens always win)
 *  become the instance's inline `width`/`height` style when present; an
 *  absent `data-height` instead adds the `fsl-autoheight` marker class, the
 *  hook preview.ts's stylesheet uses to cap an unsized diagram at a default
 *  viewport-scale height instead of letting it stretch page-tall.
 *
 *  `data-max-width`/`data-max-height` (from `max-width=`/`max-height=` fence
 *  tokens) are upper bounds honored only when the corresponding exact
 *  dimension is absent — an exact `width=`/`height=` always wins, the same
 *  precedence jssm itself documents for the tokens. `max-width` becomes the
 *  instance's own `max-width` style, but composed as `min(<max-width>, 100%)`
 *  rather than the bare token: an inline style is stronger than a stylesheet
 *  rule regardless of specificity, and preview.ts's
 *  `.fsl-fence fsl-instance { max-width: 100%; }` pane-overflow safety net
 *  lives on this same property, so writing the raw token would silently
 *  defeat that cap and let an oversized author value overflow a narrower
 *  docked pane; `min()` keeps whichever bound is smaller instead.
 *
 *  `max-height` targets the mounted
 *  `<fsl-viz>` child instead of the instance: `fsl-viz`'s shadow DOM sizes
 *  its internal container to `height: 100%` of itself, which only resolves
 *  correctly once `fsl-viz` itself has a definite height, so capping the
 *  outer `<fsl-instance>` alone (whose height stays content-driven with no
 *  exact `height=`) would not actually constrain the rendered diagram.
 *  Setting `max-height` directly on `<fsl-viz>` plus its
 *  `--jssm-viz-max-height` custom property (which jssm's viz component reads
 *  internally to cap the rendered `<svg>` while preserving aspect ratio —
 *  letterboxing rather than clipping or overflowing) is the same mechanism
 *  preview.ts's default 70vh autoheight cap already uses on that element;
 *  an explicit `max-height=` token replaces that default with the author's
 *  value rather than stacking with it, so `fsl-autoheight` is suppressed
 *  whenever `max-height` is present.
 *
 *  @example
 *  hydrate_fence(document.querySelector('.fsl-fence')!);
 *  // a ready, valid fence now shows the static SVG, with a hidden,
 *  // self-rendering <fsl-instance> that swaps in once it paints
 */
export function hydrate_fence(fence: HTMLElement): void {

  if (fence.hasAttribute(HYDRATED)) { return; }

  const doc    = fence.ownerDocument;
  const source = fence.querySelector('.fsl-fence-source')?.textContent ?? '';

  const error = validate_fsl(source);
  if (error !== null) {
    fence.setAttribute(HYDRATED, 'true');   // don't re-run on every preview update
    render_error_box(fence, error);
    return;
  }

  const svg_holder = fence.querySelector('.fsl-fence-svg');
  if (svg_holder === null) { return; }   // pending: host render not ready yet
  fence.setAttribute(HYDRATED, 'true');

  const instance = doc.createElement('fsl-instance');
  instance.setAttribute('theme', 'light');
  instance.style.display = 'none';   // hidden until the live viz's first paint

  const width      = fence.getAttribute('data-width')      ?? '';
  const height     = fence.getAttribute('data-height')     ?? '';
  const max_width  = fence.getAttribute('data-max-width')  ?? '';
  const max_height = fence.getAttribute('data-max-height') ?? '';

  if (width !== '') {
    instance.style.width = width;
  } else if (max_width !== '') {
    instance.style.maxWidth = `min(${max_width}, 100%)`;
  }

  const title = doc.createElement('span');
  title.setAttribute('slot', 'title');
  title.textContent = 'FSL machine';
  instance.appendChild(title);

  const viz = doc.createElement('fsl-viz');
  viz.setAttribute('slot', 'viz');

  if (height !== '') {
    instance.style.height = height;
  } else if (max_height !== '') {
    viz.style.maxHeight = max_height;
    viz.style.setProperty('--jssm-viz-max-height', max_height);
  } else {
    // No explicit height= or max-height= token: mark for the stylesheet's
    // default viewport-scale diagram cap (preview.ts STYLES,
    // `.fsl-autoheight`) so an unsized narrow-tall graph letterboxes instead
    // of stretching page-tall.
    instance.classList.add('fsl-autoheight');
  }

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

  fence.replaceChildren(svg_holder, instance);

  wire_first_paint_bridge(viz, instance, svg_holder);

}

/**
 *  Hydrate every ready `.fsl-fence` placeholder under `root`.  Safe to call
 *  repeatedly (per-fence idempotence guard); a *valid* fence still waiting on
 *  its host SVG is skipped and picked up on a later call once it lands, but
 *  an *invalid* fence is never skipped — it gets its `.fsl-error-box`
 *  immediately, whether or not an SVG has arrived (spec §4.9: never a silent
 *  blank).
 *
 *  @example
 *  hydrate_all(document);
 */
export function hydrate_all(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>('.fsl-fence')) {
    hydrate_fence(el);
  }
}
