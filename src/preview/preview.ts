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
