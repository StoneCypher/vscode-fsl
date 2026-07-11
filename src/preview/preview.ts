/**
 *  Preview-webview entry point.  Registers jssm's web components, hydrates
 *  every ready fsl fence placeholder (mounting the live IDE around the
 *  host-rendered SVG), keeps hydration current across preview re-renders
 *  (`vscode.markdown.updateContent` — where late-arriving host SVGs get
 *  mounted), and keeps the instances' theme in step with the VS Code theme.
 *  No `<fsl-viz>` / viz define is imported: the diagram is host-rendered.
 */
import 'jssm/wc/instance/define';
import 'jssm/wc/widgets/define';

import { hydrate_all }            from './hydrate.js';
import { theme_for_body_classes } from './theme.js';

/** Injected once: error-box styling, static-viz surface, and fence spacing. */
const STYLES = `
  .fsl-error-box { border: 2px solid #c53; border-radius: 4px; padding: 8px 12px; margin: 8px 0; }
  .fsl-error-box strong { color: #c53; display: block; margin-bottom: 4px; }
  .fsl-error-box pre { margin: 0; white-space: pre-wrap; }
  .fsl-fence { margin: 8px 0; }
  /* Host SVG is theme-fixed (Graphviz palette baked at render time); a solid
     light ground keeps it legible under a dark VS Code theme. */
  .fsl-static-viz { background: #ffffff; border-radius: 4px; padding: 4px; overflow: auto; }
  .fsl-static-viz svg { max-width: 100%; height: auto; }
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
