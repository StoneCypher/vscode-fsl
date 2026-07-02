import type MarkdownIt from 'markdown-it';
/**
 *  VS Code activation hook.  Returns the markdown-it extension point; the
 *  built-in Markdown extension calls `extendMarkdownIt` when building the
 *  preview renderer.  Task 4 wires the real fence plugin in.
 *  @example
 *  const md = activate().extendMarkdownIt(new MarkdownIt());  // returns md unchanged (Task 4 wires the real plugin)
 */
export declare function activate(): {
    extendMarkdownIt(md: MarkdownIt): MarkdownIt;
};
/**
 *  VS Code deactivation hook.  Nothing to release.
 *  @example
 *  deactivate();  // no-op
 */
export declare function deactivate(): void;
//# sourceMappingURL=extension.d.ts.map