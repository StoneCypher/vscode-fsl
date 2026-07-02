import type MarkdownIt from 'markdown-it';

/**
 *  VS Code activation hook.  Returns the markdown-it extension point; the
 *  built-in Markdown extension calls `extendMarkdownIt` when building the
 *  preview renderer.  Task 4 wires the real fence plugin in.
 */
export function activate(): { extendMarkdownIt(md: MarkdownIt): MarkdownIt } {
  return { extendMarkdownIt: (md: MarkdownIt): MarkdownIt => md };
}

/** VS Code deactivation hook.  Nothing to release. */
export function deactivate(): void { /* nothing to release */ }
