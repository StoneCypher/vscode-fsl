/**
 *  Preview-webview entry point.  Registers jssm's web components, hydrates
 *  every ready fsl fence placeholder (mounting the live IDE around a hidden,
 *  self-rendering `<fsl-instance>`/`<fsl-viz>` pair — see `hydrate.js` for
 *  the first-paint bridge that swaps it in over the host-rendered static
 *  SVG), keeps hydration current across preview re-renders
 *  (`vscode.markdown.updateContent` — where late-arriving host SVGs get
 *  mounted), and keeps the instances' theme in step with the VS Code theme.
 *  `<fsl-viz>` IS imported/defined here (Task 10b): with the preview-only
 *  asm.js Graphviz shim aliased over `@viz-js/viz` (Task 10a), it can render
 *  real SVG in-webview under the markdown CSP, so every transition is a
 *  genuine fresh render rather than a programmatic overlay highlight.
 */
import 'jssm/wc/instance/define';
import 'jssm/wc/viz/define';
import 'jssm/wc/widgets/define';

import { hydrate_all }            from './hydrate.js';
import { theme_for_body_classes } from './theme.js';

/** Injected once: error-box styling, the host-rendered static-SVG surface, and fence spacing. */
const STYLES = `
  .fsl-error-box { border: 2px solid #c53; border-radius: 4px; padding: 8px 12px; margin: 8px 0; }
  .fsl-error-box strong { color: #c53; display: block; margin-bottom: 4px; }
  .fsl-error-box pre { margin: 0; white-space: pre-wrap; }
  .fsl-fence { margin: 8px 0; }
  /* Host SVG is theme-fixed (Graphviz palette baked at render time); a solid
     light ground keeps it legible under a dark VS Code theme. Shown until
     the live fsl-viz's first-paint bridge removes it (see hydrate.js). */
  .fsl-fence-svg { background: #ffffff; border-radius: 4px; padding: 4px; overflow: auto; }
  .fsl-fence-svg svg { max-width: 100%; height: auto; }
  /* Default diagram size cap (no explicit width=/height= fence token — spec
     §5.2 explicit sizing always wins over this default). An unsized
     narrow-tall graph would otherwise stretch to the preview's full width
     and follow its aspect ratio to several screens tall (jssm's <fsl-viz>
     shadow CSS sizes its container to width:100%/height:100% of its host —
     node_modules/jssm/dist/wc/viz.js); capping the host's box here
     letterboxes the graph instead, since the underlying SVG carries a
     viewBox + default preserveAspectRatio. max-width applies to every
     instance regardless of sizing so it never overflows the preview pane;
     the max-height cap is scoped to the unsized case only. */
  .fsl-fence fsl-instance { max-width: 100%; }
  /* Both halves of the cap: max-height bounds the host box, and jssm >= 5.162.25's
     documented --jssm-viz-max-height custom property re-threads the same cap
     through the component's shadow DOM to the rendered svg (aspect preserved,
     letterboxed). Without the property the inner svg falls back to intrinsic
     Graphviz size and overflows the capped host (StoneCypher/fsl#1934). */
  .fsl-fence fsl-instance.fsl-autoheight fsl-viz[slot="viz"] { max-height: 70vh; --jssm-viz-max-height: 70vh; }
  /* Matching cap on the first-paint static SVG so pre-swap and post-swap
     presentation agree. [data-height=""] is the "no explicit height" marker
     fence_plugin.ts already stamps on every unsized fence at render time —
     true from first paint, before hydrate.js ever runs. */
  .fsl-fence[data-height=""] .fsl-fence-svg svg { max-height: 70vh; }
`;

function inject_styles(): void {
  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function apply_theme(): void {
  const variant = theme_for_body_classes(document.body.classList);
  for (const el of document.querySelectorAll('fsl-instance')) {
    el.setAttribute('theme', variant);
  }
}

function refresh(): void {
  hydrate_all(document);
  apply_theme();
}

inject_styles();
refresh();

window.addEventListener('vscode.markdown.updateContent', refresh);

new MutationObserver(apply_theme)
  .observe(document.body, { attributes: true, attributeFilter: ['class'] });
