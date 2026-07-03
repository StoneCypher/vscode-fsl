import type MarkdownIt        from 'markdown-it';
import { fsl_fence_plugin }   from './fence_plugin.js';
import { render_fsl_svg }     from './render_machine.js';
import { create_render_queue } from './render_queue.js';

/** Debounce window before a completed host render triggers a preview refresh. */
const REFRESH_DEBOUNCE_MS = 120;

/**
 *  Build the "renders are ready" callback: a debounced trigger of the built-in
 *  `markdown.preview.refresh` command.  `'vscode'` is imported LAZILY (inside
 *  the timer) so this module still loads under vitest, where the host `vscode`
 *  module is absent — the import only resolves in the real extension host.
 *  Manually verified in Task 8 (the refresh loop isn't reachable from vitest).
 *
 *  @example
 *  const refresh = make_refresh_trigger();
 *  refresh();  // schedules a debounced `markdown.preview.refresh` (no-op outside the extension host)
 */
function make_refresh_trigger(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer !== undefined) { clearTimeout(timer); }
    timer = setTimeout(() => {
      void import('vscode')
        .then((v) => v.commands.executeCommand('markdown.preview.refresh'))
        .catch(() => { /* not in the extension host (e.g. tests) — nothing to refresh */ });
    }, REFRESH_DEBOUNCE_MS);
  };
}

/**
 *  VS Code activation hook.  Builds the host-side render queue and returns the
 *  markdown-it extension point; the built-in Markdown extension calls
 *  `extendMarkdownIt` once when building the preview renderer, and the plugin
 *  installed there rewrites fsl/jssm fences into hydration placeholders,
 *  inlining a cached host-rendered SVG as soon as one is available (see
 *  fence_plugin.ts / render_queue.ts).
 *
 *  @example
 *  const md = activate().extendMarkdownIt(new MarkdownIt());
 *  md.render('```fsl\na -> b;\n```\n');  // contains class="fsl-fence"
 */
export function activate(): { extendMarkdownIt(md: MarkdownIt): MarkdownIt } {
  const queue = create_render_queue({
    render:   render_fsl_svg,
    on_ready: make_refresh_trigger(),
  });
  return {
    extendMarkdownIt(md: MarkdownIt): MarkdownIt {
      fsl_fence_plugin(md, { get_svg: queue.get_svg });
      return md;
    },
  };
}

/**
 *  VS Code deactivation hook.  Nothing to release.
 *  @example
 *  deactivate();  // no-op
 */
export function deactivate(): void { /* nothing to release */ }
