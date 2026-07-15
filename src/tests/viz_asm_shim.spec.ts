// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { instance } from '../preview/viz_asm_shim.js';

// asm.js Graphviz does a one-time synchronous compile/warmup on first
// construction (viz.js@2 has no cold/warm split) — generous timeouts so a
// slow CI box doesn't flake.
const WARMUP_TIMEOUT = 20_000;

describe('viz_asm_shim instance()', () => {

  it('renders valid dot to real SVG markup via the same renderString(dot, {format}) surface jssm_viz uses', async () => {
    const viz = await instance();
    const svg = await viz.renderString('digraph { a -> b; }', { format: 'svg' });
    expect(svg).toContain('<svg');
    expect(svg).toMatch(/id="[^"]*\ba\b[^"]*"|>a<|title>a</);
    expect(svg).toMatch(/id="[^"]*\bb\b[^"]*"|>b<|title>b</);
  }, WARMUP_TIMEOUT);

  it('rejects invalid dot AND a subsequent valid render still succeeds (recreate-on-error)', async () => {
    const viz = await instance();
    await expect(viz.renderString('this is not { valid dot at all', { format: 'svg' })).rejects.toThrow();
    const svg = await viz.renderString('digraph { x -> y; }', { format: 'svg' });
    expect(svg).toContain('<svg');
  }, WARMUP_TIMEOUT);

});
