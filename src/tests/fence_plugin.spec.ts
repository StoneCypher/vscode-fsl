import { describe, it, expect, vi } from 'vitest';
import MarkdownIt                   from 'markdown-it';
import { fsl_fence_plugin, dimension_to_css } from '../fence_plugin.js';
import type { GetSvg } from '../fence_plugin.js';

/** Build a markdown-it with the plugin wired to a fixed get_svg (default: all misses). */
const make_md = (get_svg: GetSvg = () => null): MarkdownIt => {
  const m = new MarkdownIt();
  fsl_fence_plugin(m, { get_svg });
  return m;
};

describe('dimension_to_css', () => {

  it('serializes null, px, and percent', () => {
    expect(dimension_to_css(null)).toBe('');
    expect(dimension_to_css({ value: 300, unit: 'px'      })).toBe('300px');
    expect(dimension_to_css({ value: 50,  unit: 'percent' })).toBe('50%');
  });

});

describe('fsl_fence_plugin', () => {

  it('renders a cache MISS as a placeholder with escaped source and no SVG', () => {
    const html = make_md().render('```fsl\na -> b;\n```\n');
    expect(html).toContain('class="fsl-fence"');
    expect(html).toContain('fsl-fence-source');
    expect(html).toContain('a -&gt; b;');
    expect(html).not.toContain('fsl-fence-svg');
  });

  it('inlines the SVG BEFORE the source pre on a cache HIT', () => {
    const html = make_md(() => '<svg data-test="ok"></svg>').render('```fsl\na -> b;\n```\n');
    expect(html).toContain('class="fsl-fence-svg"');
    expect(html).toContain('<svg data-test="ok">');
    expect(html.indexOf('fsl-fence-svg')).toBeLessThan(html.indexOf('fsl-fence-source'));
  });

  it('passes the raw (unescaped) source and the parsed descriptor to get_svg', () => {
    const get_svg = vi.fn<GetSvg>(() => null);
    make_md(get_svg).render('```fsl width=300\na -> b;\n```\n');
    expect(get_svg).toHaveBeenCalledOnce();
    const [source, desc] = get_svg.mock.calls[0]!;
    expect(source).toBe('a -> b;\n');
    expect(desc.width).toEqual({ value: 300, unit: 'px' });
  });

  it('accepts the jssm synonym, case-insensitively', () => {
    expect(make_md().render('```JSSM\na -> b;\n```\n')).toContain('class="fsl-fence"');
  });

  it('leaves non-fsl fences to the default renderer', () => {
    const html = make_md().render('```js\nconst x = 1;\n```\n');
    expect(html).not.toContain('fsl-fence');
    expect(html).toContain('language-js');
  });

  it('leaves plain (no-language) fences alone', () => {
    expect(make_md().render('```\nplain\n```\n')).not.toContain('fsl-fence');
  });

  it('escapes HTML in machine source — no script injection', () => {
    const html = make_md().render('```fsl\na "<script>alert(1)</script>" -> b;\n```\n');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('carries width/height through as CSS lengths in data attributes', () => {
    const html = make_md().render('```fsl width=300 height=50%\na -> b;\n```\n');
    expect(html).toContain('data-width="300px"');
    expect(html).toContain('data-height="50%"');
  });

  it('emits empty data attributes when no dimensions are given', () => {
    const html = make_md().render('```fsl\na -> b;\n```\n');
    expect(html).toContain('data-width=""');
    expect(html).toContain('data-height=""');
  });

  it('carries max-width/max-height through as CSS lengths in data attributes', () => {
    const html = make_md().render('```fsl max-width=500 max-height=25%\na -> b;\n```\n');
    expect(html).toContain('data-max-width="500px"');
    expect(html).toContain('data-max-height="25%"');
  });

  it('emits empty data-max-width/data-max-height when no max dimensions are given', () => {
    const html = make_md().render('```fsl\na -> b;\n```\n');
    expect(html).toContain('data-max-width=""');
    expect(html).toContain('data-max-height=""');
  });

  it('stamps a --fsl-max-height inline custom property when max-height is given, so the ' +
     'first-paint static SVG honors the author token instead of the stylesheet default', () => {
    const html = make_md().render('```fsl max-height=200\na -> b;\n```\n');
    expect(html).toContain('style="--fsl-max-height:200px"');
  });

  it('omits the --fsl-max-height inline style when no max-height token is given', () => {
    const html = make_md().render('```fsl\na -> b;\n```\n');
    expect(html).not.toContain('--fsl-max-height');
    expect(html).not.toContain(' style="');
  });

});
