// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { highlight_state, clear_highlights } from '../preview/highlight.js';

/** A two-node graphviz-shaped SVG (nodes titled 'a' and 'b'). */
function make_svg(): SVGElement {
  const holder = document.createElement('div');
  holder.innerHTML =
    '<svg><g class="graph">' +
    '<g class="node"><title>a</title><ellipse/></g>' +
    '<g class="node"><title>b</title><ellipse/></g>' +
    '</g></svg>';
  return holder.querySelector('svg')!;
}

describe('highlight_state', () => {

  it('strokes the matching state node and leaves others unstyled', () => {
    const svg = make_svg();
    highlight_state(svg, 'a', { color: '#2e7d32' });
    const [a, b] = [...svg.querySelectorAll('.node')];
    expect((a!.querySelector('ellipse') as SVGElement).style.stroke).toBe('#2e7d32');
    expect((b!.querySelector('ellipse') as SVGElement).style.stroke).toBe('');
  });

  it('moves the highlight when the state changes', () => {
    const svg = make_svg();
    highlight_state(svg, 'a');
    highlight_state(svg, 'b');
    const [a, b] = [...svg.querySelectorAll('.node')];
    expect((a!.querySelector('ellipse') as SVGElement).style.stroke).toBe('');
    expect((b!.querySelector('ellipse') as SVGElement).style.stroke).not.toBe('');
  });

  it('is a no-op for an unknown state', () => {
    const svg = make_svg();
    highlight_state(svg, 'nope');
    for (const e of svg.querySelectorAll('ellipse')) {
      expect((e as SVGElement).style.stroke).toBe('');
    }
  });

  it('matches a jssm-slugged node title (host-rendered SVG has lowercased, hyphenated titles)', () => {
    const holder = document.createElement('div');
    holder.innerHTML =
      '<svg><g class="graph">' +
      '<g class="node"><title>red</title><polygon/><text>Red</text></g>' +
      '</g></svg>';
    const svg = holder.querySelector('svg')!;
    highlight_state(svg, 'Red');
    const polygon = svg.querySelector('polygon') as SVGElement;
    expect(polygon.style.stroke).not.toBe('');
  });

  it('slugs a multi-word state the same way jssm slugs its node titles', () => {
    const holder = document.createElement('div');
    holder.innerHTML =
      '<svg><g class="graph">' +
      '<g class="node"><title>foo-bar</title><ellipse/></g>' +
      '</g></svg>';
    const svg = holder.querySelector('svg')!;
    highlight_state(svg, 'Foo Bar');
    const ellipse = svg.querySelector('ellipse') as SVGElement;
    expect(ellipse.style.stroke).not.toBe('');
  });

  it('still matches an exact, unslugged title (compatibility with unslugged SVGs)', () => {
    const holder = document.createElement('div');
    holder.innerHTML =
      '<svg><g class="graph">' +
      '<g class="node"><title>Red</title><ellipse/></g>' +
      '</g></svg>';
    const svg = holder.querySelector('svg')!;
    highlight_state(svg, 'Red');
    const ellipse = svg.querySelector('ellipse') as SVGElement;
    expect(ellipse.style.stroke).not.toBe('');
  });

  it('is a no-op for a state that matches neither the raw nor the slugged title', () => {
    const holder = document.createElement('div');
    holder.innerHTML =
      '<svg><g class="graph">' +
      '<g class="node"><title>red</title><ellipse/></g>' +
      '</g></svg>';
    const svg = holder.querySelector('svg')!;
    highlight_state(svg, 'Blue');
    const ellipse = svg.querySelector('ellipse') as SVGElement;
    expect(ellipse.style.stroke).toBe('');
  });

});

describe('clear_highlights', () => {

  it('removes every inline override it installed', () => {
    const svg = make_svg();
    highlight_state(svg, 'a');
    clear_highlights(svg);
    const a = svg.querySelector('.node ellipse') as SVGElement;
    expect(a.style.stroke).toBe('');
  });

});
