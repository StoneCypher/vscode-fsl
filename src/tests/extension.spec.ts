import { describe, it, expect } from 'vitest';
import MarkdownIt              from 'markdown-it';
import { activate }            from '../extension.js';

describe('activate', () => {

  it('returns an extendMarkdownIt that installs the fsl fence rule', () => {
    const md = activate().extendMarkdownIt(new MarkdownIt());
    // Cache is empty on first render, so the fence is the source-only placeholder.
    expect(md.render('```fsl\na -> b;\n```\n')).toContain('class="fsl-fence"');
  });

  it('returns the same markdown-it instance it was given', () => {
    const md = new MarkdownIt();
    expect(activate().extendMarkdownIt(md)).toBe(md);
  });

});
