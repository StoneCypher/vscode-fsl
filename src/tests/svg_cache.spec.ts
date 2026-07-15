import { describe, it, expect } from 'vitest';
import { fnv1a, svg_cache_key, LruCache } from '../svg_cache.js';

describe('fnv1a', () => {

  it('is deterministic and 8 lowercase hex chars', () => {
    expect(fnv1a('a -> b;')).toBe(fnv1a('a -> b;'));
    expect(fnv1a('a -> b;')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('distinguishes different inputs', () => {
    expect(fnv1a('a -> b;')).not.toBe(fnv1a('a -> c;'));
  });

});

describe('svg_cache_key', () => {

  it('varies with source, width, and height independently', () => {
    const base = svg_cache_key('a -> b;', '', '');
    expect(svg_cache_key('a -> c;', '',      '')).not.toBe(base);
    expect(svg_cache_key('a -> b;', '300px', '')).not.toBe(base);
    expect(svg_cache_key('a -> b;', '',  '50%')).not.toBe(base);
  });

  it('is stable for identical (source, width, height)', () => {
    expect(svg_cache_key('a -> b;', '300px', '50%')).toBe(svg_cache_key('a -> b;', '300px', '50%'));
  });

});

describe('LruCache', () => {

  it('rejects a non-positive capacity', () => {
    expect(() => new LruCache(0)).toThrow(RangeError);
  });

  it('stores and retrieves', () => {
    const c = new LruCache(2);
    c.set('a', '1');
    expect(c.get('a')).toBe('1');
    expect(c.get('missing')).toBeNull();
  });

  it('evicts the least-recently-used entry past capacity', () => {
    const c = new LruCache(2);
    c.set('a', '1');
    c.set('b', '2');
    c.set('c', '3');           // 'a' is LRU → evicted
    expect(c.has('a')).toBe(false);
    expect(c.has('b')).toBe(true);
    expect(c.has('c')).toBe(true);
  });

  it('get promotes an entry so it survives the next eviction', () => {
    const c = new LruCache(2);
    c.set('a', '1');
    c.set('b', '2');
    expect(c.get('a')).toBe('1'); // 'a' now most-recent; 'b' is LRU
    c.set('c', '3');              // evicts 'b', not 'a'
    expect(c.has('a')).toBe(true);
    expect(c.has('b')).toBe(false);
  });

});
