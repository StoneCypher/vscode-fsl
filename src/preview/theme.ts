/**
 *  Map the VS Code preview body's theme classes to a concrete fsl-instance
 *  theme variant.  `vscode-high-contrast` (dark HC) counts as dark;
 *  `vscode-high-contrast-light` as light; unknown defaults to light.
 *
 *  The webview's own `prefers-color-scheme` tracks the OS rather than the
 *  VS Code theme, so `<fsl-instance theme="system">` would follow the wrong
 *  signal — this helper exists to follow the editor instead.
 *
 *  @example
 *  theme_for_body_classes(document.body.classList);  // 'dark'
 */
export function theme_for_body_classes(classList: DOMTokenList): 'light' | 'dark' {
  if (classList.contains('vscode-high-contrast-light')) { return 'light'; }
  if (classList.contains('vscode-dark'))                { return 'dark';  }
  if (classList.contains('vscode-high-contrast'))       { return 'dark';  }
  return 'light';
}
