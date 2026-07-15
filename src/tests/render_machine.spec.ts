import { describe, it, expect } from 'vitest';
import { render_fsl_svg } from '../render_machine.js';

describe('render_fsl_svg', () => {

  it('renders valid FSL to an SVG string (Node, no CSP)', async () => {
    const svg = await render_fsl_svg('a -> b;');
    expect(svg).toContain('<svg');
  });

  it('rejects on unparseable FSL so the caller can surface the error', async () => {
    await expect(render_fsl_svg('this is not -> valid ->;')).rejects.toThrow();
  });

});
