import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync, rmSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { resolveGrammarSource, copyGrammarFile } from '../build_js/copy_grammars.js';

/**
 * Structural test: does the actual copy-and-register mechanism work end to
 * end? Unlike copy_grammars.spec.ts (which exercises the pure/DI'd pieces
 * against mocks), this suite performs a real resolve-then-copy against the
 * real filesystem and cross-checks it against the real package.json manifest
 * and .vscodeignore allowlist, so a broken wiring between the three shows up
 * here even if the mocked unit tests all pass.
 *
 * Deliberately does NOT call `main()` (which always writes to the real,
 * tracked `./syntaxes/fsl.tmLanguage.json`): every test run would rewrite
 * that committed file, and a future jssm version bump that changes the
 * grammar's content would then produce a silent, unreviewed diff the next
 * time anyone ran the suite. Instead this exercises the same
 * `resolveGrammarSource` → `copyGrammarFile` pipeline `main()` uses, but
 * targets a throwaway temp path, and separately asserts the temp copy is
 * structurally identical (parsed-JSON deep-equal, not raw-byte-equal — the
 * tracked file checks out with LF line endings while the freshly-resolved
 * node_modules copy carries jssm's own CRLF, an incidental cross-platform
 * line-ending difference that has nothing to do with grammar content) to the
 * tracked file — proving the tracked copy is still an accurate cache of
 * jssm's published grammar without ever writing to it.
 */

const PROJECT_ROOT = process.cwd();
const GRAMMAR_PATH = join(PROJECT_ROOT, 'syntaxes', 'fsl.tmLanguage.json');

let tempDir: string;
let tempGrammarPath: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'vscode-fsl-grammar-'));
  tempGrammarPath = join(tempDir, 'fsl.tmLanguage.json');
  copyGrammarFile(resolveGrammarSource(), tempGrammarPath);
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('copy_grammars — real run (temp destination, tracked file untouched)', () => {
  it('writes a readable, valid grammar file to a temp path', () => {
    expect(existsSync(tempGrammarPath)).toBe(true);
    const text = readFileSync(tempGrammarPath, 'utf8');
    const parsed = JSON.parse(text) as { scopeName?: string };
    expect(parsed.scopeName).toBe('source.fsl');
  });

  it('matches the tracked ./syntaxes/fsl.tmLanguage.json structurally — the tracked file is a cache of this resolved content', () => {
    const tracked = JSON.parse(readFileSync(GRAMMAR_PATH, 'utf8')) as unknown;
    const fresh   = JSON.parse(readFileSync(tempGrammarPath, 'utf8')) as unknown;
    expect(fresh).toEqual(tracked);
  });
});

describe('package.json — contributes.grammars registration', () => {
  it('registers the copied grammar for the fsl language', () => {
    const pkg = JSON.parse(
      readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8'),
    ) as { contributes?: { grammars?: Array<{ language?: string; scopeName?: string; path?: string }> } };

    const grammars = pkg.contributes?.grammars ?? [];
    const entry = grammars.find(g => g.language === 'fsl');

    expect(entry).toBeDefined();
    expect(entry?.scopeName).toBe('source.fsl');
    expect(entry?.path).toBe('./syntaxes/fsl.tmLanguage.json');
  });
});

describe('.vscodeignore — syntaxes/ admitted into the VSIX', () => {
  it('contains an allowlist line admitting syntaxes/**', () => {
    const text = readFileSync(join(PROJECT_ROOT, '.vscodeignore'), 'utf8');
    const lines = text.split(/\r?\n/).map(l => l.trim());
    expect(lines).toContain('!syntaxes/**');
  });
});
