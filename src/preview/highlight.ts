/**
 *  Programmatic highlighting of a host-rendered Graphviz SVG — the fallback's
 *  substitute for `<fsl-viz>`'s internal `highlightTrace`, which only styles
 *  SVG living in fsl-viz's own shadow root and would re-run Graphviz WASM
 *  (blocked under the preview CSP).  Matches Graphviz's own `<title>`
 *  convention so behavior tracks the live component
 *  (`node_modules/jssm/dist/wc/viz.js:412-472`).
 */

/** Undo the `&#45;` / `&gt;` escaping Graphviz emits inside `<title>`. */
function unescape_title(title: string): string {
  return title.replace(/&#45;/g, '-').replace(/&gt;/g, '>').replace(/"/g, '');
}

/**
 *  Slug a state name into jssm's dot node-id form — lowercased, non
 *  alphanumeric runs collapsed to a single hyphen, leading/trailing hyphens
 *  trimmed. Mirrors `slug_for` in `node_modules/jssm/dist/jssm_viz.mjs`
 *  EXACTLY (`state.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")`)
 *  and must track it if jssm's slugging ever changes: the host-rendered
 *  Graphviz SVG's `<title>` elements are these slugged ids, not the raw
 *  state names.
 *
 *  @param state The machine's state name, in its natural (unslugged) case.
 *  @returns The same string as jssm would slug it for a dot node id.
 *
 *  @example
 *  slug_for('Foo Bar'); // 'foo-bar'
 */
function slug_for(state: string): string {
  return state.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 *  Remove every inline fill/stroke/opacity override this module installs,
 *  restoring the SVG's own Graphviz presentation.  Safe on an un-highlighted
 *  SVG, before the first highlight, or on an empty container.
 *
 *  @example
 *  clear_highlights(document.querySelector('.fsl-static-viz')!);
 */
export function clear_highlights(root: Element): void {
  for (const el of root.querySelectorAll<SVGElement>('.node, .edge, .node *, .edge *')) {
    el.style.removeProperty('fill');
    el.style.removeProperty('stroke');
    el.style.removeProperty('opacity');
  }
}

/**
 *  Emphasize the current-state node by name: clears prior highlights, then
 *  strokes the `.node` whose Graphviz `<title>` matches `state` and recolors
 *  its label.  A node matches when its unescaped title equals either the raw
 *  `state` (compatibility with any SVG whose titles aren't slugged) or
 *  `slug_for(state)` (jssm's host-rendered dot output, whose node ids are
 *  lowercased and hyphenated).  No-op for an unknown state or an empty SVG.
 *  A single-state emphasis (not a trace) — a live preview only needs to show
 *  *where* the machine is now.
 *
 *  @param root    The rendered `<svg>` (or a container holding it).
 *  @param state   The machine's current state name (`machine.state()`).
 *  @param options `color` overrides the stroke/label color (default crimson).
 *
 *  @example
 *  // host SVG has `<title>green</title>` (jssm's slug of state 'Green')
 *  highlight_state(vizDiv, 'Green', { color: '#2e7d32' });
 */
export function highlight_state(root: Element, state: string, options: { color?: string } = {}): void {
  clear_highlights(root);
  const color = options.color ?? '#b71c1c';
  const slugged = slug_for(state);
  for (const node of root.querySelectorAll<SVGGElement>('.node')) {
    const title_el = node.querySelector('title');
    const title    = title_el ? unescape_title(title_el.textContent) : '';
    if (title !== state && title !== slugged) { continue; }
    for (const shape of node.querySelectorAll<SVGElement>('polygon, ellipse, path')) {
      shape.style.stroke      = color;
      shape.style.strokeWidth = '2px';
    }
    for (const text of node.querySelectorAll<SVGElement>('text')) {
      text.style.fill = color;
    }
  }
}
