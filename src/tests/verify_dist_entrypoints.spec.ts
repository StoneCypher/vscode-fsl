import { describe, it, expect, vi } from 'vitest';
import {
  missingCallableExports,
  manifestHasNoTypeField,
  main,
} from '../build_js/verify_dist_entrypoints.js';

describe('missingCallableExports', () => {
  it('returns an empty list when both required exports are callable', () => {
    expect(missingCallableExports({ activate: () => {}, deactivate: () => {} })).toEqual([]);
  });

  it('reports a missing export', () => {
    expect(missingCallableExports({ activate: () => {} })).toEqual(['deactivate']);
  });

  it('reports a non-function export as missing', () => {
    expect(missingCallableExports({ activate: 'nope', deactivate: () => {} })).toEqual(['activate']);
  });

  it('reports both when the module is empty', () => {
    expect(missingCallableExports({})).toEqual(['activate', 'deactivate']);
  });

  it('tolerates a null/undefined module', () => {
    expect(missingCallableExports(null)).toEqual(['activate', 'deactivate']);
    expect(missingCallableExports(undefined)).toEqual(['activate', 'deactivate']);
  });

  it('accepts a custom export-name list', () => {
    expect(missingCallableExports({ foo: () => {} }, ['foo', 'bar'])).toEqual(['bar']);
  });
});

describe('manifestHasNoTypeField', () => {
  it('is true when the manifest has no type field', () => {
    expect(manifestHasNoTypeField({ name: 'vscode-fsl' })).toBe(true);
  });

  it('is false when the manifest declares "type": "module"', () => {
    expect(manifestHasNoTypeField({ name: 'vscode-fsl', type: 'module' })).toBe(false);
  });

  it('is false when the manifest declares "type": "commonjs"', () => {
    expect(manifestHasNoTypeField({ name: 'vscode-fsl', type: 'commonjs' })).toBe(false);
  });
});

describe('main', () => {
  it('resolves silently when both guards pass', () => {
    const loadDistExports = vi.fn(() => ({ activate: () => {}, deactivate: () => {} }));
    const loadRootPackage = vi.fn(() => ({ name: 'vscode-fsl' }));
    expect(() => main(loadDistExports, loadRootPackage)).not.toThrow();
    expect(loadDistExports).toHaveBeenCalledTimes(1);
    expect(loadRootPackage).toHaveBeenCalledTimes(1);
  });

  it('throws naming the missing export(s) without reading package.json', () => {
    const loadDistExports = vi.fn(() => ({ activate: () => {} }));
    const loadRootPackage = vi.fn(() => ({ name: 'vscode-fsl' }));
    expect(() => main(loadDistExports, loadRootPackage)).toThrow(/deactivate/);
    expect(loadRootPackage).not.toHaveBeenCalled();
  });

  it('throws when the manifest carries a top-level "type" field', () => {
    const loadDistExports = vi.fn(() => ({ activate: () => {}, deactivate: () => {} }));
    const loadRootPackage = vi.fn(() => ({ name: 'vscode-fsl', type: 'module' }));
    expect(() => main(loadDistExports, loadRootPackage)).toThrow(/"type"/);
  });
});
