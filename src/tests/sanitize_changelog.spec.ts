import { describe, it, expect } from 'vitest';
import { sanitize_markdown_tags } from '../build_js/sanitize_changelog.js';

describe('sanitize_markdown_tags', () => {

  it('escapes an opening tag with attributes', () => {
    expect(sanitize_markdown_tags('<svg width="1">')).toBe('&lt;svg width="1">');
  });

  it('escapes a closing tag', () => {
    expect(sanitize_markdown_tags('</svg>')).toBe('&lt;/svg>');
  });

  it('leaves math comparisons untouched', () => {
    expect(sanitize_markdown_tags('a < b')).toBe('a < b');
  });

  it('escapes a tag inside a backticked code span', () => {
    expect(sanitize_markdown_tags('`<svg>`')).toBe('`&lt;svg>`');
  });

  it('is idempotent', () => {
    const once = sanitize_markdown_tags('<svg> a < b </svg>');
    expect(sanitize_markdown_tags(once)).toBe(once);
  });

});
