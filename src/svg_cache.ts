/**
 *  Deterministic cache key + a bounded LRU for host-rendered fence SVGs.
 *  Pure and dependency-free, so it unit-tests in plain node vitest.
 */

/**
 *  FNV-1a 32-bit hash of a string as an 8-char lowercase hex string.
 *  Deterministic and well-distributed enough to key a render cache; NOT
 *  cryptographic.  `Math.imul` keeps the multiply in 32-bit space.
 *
 *  @example
 *  fnv1a('a -> b;') === fnv1a('a -> b;');  // true (stable)
 */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 *  Cache key for one fence render: a hash of `(source, width, height)` so two
 *  fences with identical source but different dimensions never collide.  (The
 *  host SVG is itself dimension-independent — width/height are CSS applied
 *  later on the instance — but keying on them exactly as the spec states is
 *  the conservative choice.)  A NUL separator keeps the fields unambiguous.
 *
 *  @example
 *  svg_cache_key('a -> b;', '300px', '');  // 'fsl-…'
 */
export function svg_cache_key(source: string, width: string, height: string): string {
  return `fsl-${fnv1a(`${width}\u0000${height}\u0000${source}`)}`;
}

/**
 *  Fixed-capacity least-recently-used string cache.  `get` promotes the key to
 *  most-recent and returns `null` on a miss; `set` inserts/promotes and, once
 *  `capacity` is exceeded, evicts the single least-recently-used entry
 *  (Map preserves insertion order, so its first key is the LRU one).
 *
 *  @example
 *  const c = new LruCache(2);
 *  c.set('a', '1'); c.set('b', '2'); c.get('a'); c.set('c', '3');
 *  c.has('b');  // false — 'b' was least-recently-used and got evicted
 *
 *  @throws RangeError when `capacity` is not a positive integer.
 */
export class LruCache {

  readonly #capacity: number;
  readonly #map = new Map<string, string>();

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`LruCache capacity must be a positive integer, got ${String(capacity)}`);
    }
    this.#capacity = capacity;
  }

  /** True when `key` is present (without promoting it). */
  has(key: string): boolean { return this.#map.has(key); }

  /** Value for `key`, promoted to most-recent, or `null` on a miss. */
  get(key: string): string | null {
    const value = this.#map.get(key);
    if (value === undefined) { return null; }
    this.#map.delete(key);
    this.#map.set(key, value);
    return value;
  }

  /** Insert or update `key`, promoting it and evicting the LRU entry if full. */
  set(key: string, value: string): void {
    this.#map.delete(key);
    this.#map.set(key, value);
    while (this.#map.size > this.#capacity) {
      const oldest = this.#map.keys().next().value;
      if (oldest === undefined) { break; }
      this.#map.delete(oldest);
    }
  }

  /** Number of entries currently held. */
  get size(): number { return this.#map.size; }

}
