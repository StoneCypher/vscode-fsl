import { describe, it, expect, vi } from 'vitest';
import {
  resolveGrammarSource,
  copyGrammarFile,
  main,
} from '../build_js/copy_grammars.js';

describe('resolveGrammarSource', () => {
  it('calls the injected resolver with "jssm/grammar" and returns its result', () => {
    const resolveFn = vi.fn(() => '/abs/path/to/fsl.tmLanguage.json');
    expect(resolveGrammarSource(resolveFn)).toBe('/abs/path/to/fsl.tmLanguage.json');
    expect(resolveFn).toHaveBeenCalledWith('jssm/grammar');
    expect(resolveFn).toHaveBeenCalledTimes(1);
  });
});

describe('copyGrammarFile', () => {
  it('reads the source via io, creates the destination directory recursively, writes the text, and returns it', () => {
    const readFileSync = vi.fn(() => '{"scopeName":"source.fsl"}');
    const mkdirSync = vi.fn();
    const writeFileSync = vi.fn();
    const io = { readFileSync, mkdirSync, writeFileSync };

    const result = copyGrammarFile(
      '/src/fsl.tmLanguage.json',
      '/dest/syntaxes/fsl.tmLanguage.json',
      io,
    );

    expect(readFileSync).toHaveBeenCalledWith('/src/fsl.tmLanguage.json', 'utf8');
    expect(mkdirSync).toHaveBeenCalledWith('/dest/syntaxes', { recursive: true });
    expect(writeFileSync).toHaveBeenCalledWith(
      '/dest/syntaxes/fsl.tmLanguage.json',
      '{"scopeName":"source.fsl"}',
      'utf8',
    );
    expect(result).toBe('{"scopeName":"source.fsl"}');
  });
});

describe('main', () => {
  it('resolves the grammar source, then copies it via io, returning the copied text', () => {
    const resolve = vi.fn(() => '/node_modules/jssm/dist/grammars/fsl.tmLanguage.json');
    const readFileSync = vi.fn(() => '{"scopeName":"source.fsl"}');
    const mkdirSync = vi.fn();
    const writeFileSync = vi.fn();
    const io = { readFileSync, mkdirSync, writeFileSync };

    const result = main(resolve, io);

    expect(resolve).toHaveBeenCalledWith('jssm/grammar');
    expect(readFileSync).toHaveBeenCalledWith(
      '/node_modules/jssm/dist/grammars/fsl.tmLanguage.json',
      'utf8',
    );
    expect(writeFileSync).toHaveBeenCalledTimes(1);

    const [destPath, text, encoding] = writeFileSync.mock.calls[0] as [string, string, string];
    expect(destPath.replace(/\\/g, '/')).toMatch(/\/syntaxes\/fsl\.tmLanguage\.json$/);
    expect(text).toBe('{"scopeName":"source.fsl"}');
    expect(encoding).toBe('utf8');
    expect(result).toBe('{"scopeName":"source.fsl"}');
  });

  it('does not swallow a resolver failure (e.g. jssm/grammar missing)', () => {
    const resolve = vi.fn(() => {
      throw new Error('Cannot find module \'jssm/grammar\'');
    });
    const io = { readFileSync: vi.fn(), mkdirSync: vi.fn(), writeFileSync: vi.fn() };
    expect(() => main(resolve, io)).toThrow(/jssm\/grammar/);
    expect(io.readFileSync).not.toHaveBeenCalled();
  });
});
