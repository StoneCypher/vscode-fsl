// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { theme_for_body_classes } from '../preview/theme.js';

const classes = (...names: string[]): DOMTokenList => {
  const el = document.createElement('div');
  for (const n of names) { el.classList.add(n); }
  return el.classList;
};

describe('theme_for_body_classes', () => {

  it('maps vscode-dark and vscode-high-contrast to dark', () => {
    expect(theme_for_body_classes(classes('vscode-dark'))).toBe('dark');
    expect(theme_for_body_classes(classes('vscode-high-contrast'))).toBe('dark');
  });

  it('maps vscode-light and high-contrast-light to light', () => {
    expect(theme_for_body_classes(classes('vscode-light'))).toBe('light');
    expect(theme_for_body_classes(classes('vscode-high-contrast-light'))).toBe('light');
  });

  it('defaults to light when no vscode class is present', () => {
    expect(theme_for_body_classes(classes('unrelated'))).toBe('light');
  });

});
