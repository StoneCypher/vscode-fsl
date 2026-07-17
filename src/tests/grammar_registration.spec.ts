import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { main } from '../build_js/copy_grammars.js';

/**
 * Structural test: does the actual copy-and-register mechanism work end to
 * end? Unlike copy_grammars.spec.ts (which exercises the pure/DI'd pieces
 * against mocks), this suite performs a real copy against the real
 * filesystem and cross-checks it against the real package.json manifest and
 * .vscodeignore allowlist, so a broken wiring between the three shows up
 * here even if the mocked unit tests all pass.
 */

const PROJECT_ROOT = process.cwd();
const GRAMMAR_PATH = join(PROJECT_ROOT, 'syntaxes', 'fsl.tmLanguage.json');

beforeAll(() => {
  main();
});

describe('copy_grammars — real run', () => {
  it('writes a readable, valid ./syntaxes/fsl.tmLanguage.json', () => {
    expect(existsSync(GRAMMAR_PATH)).toBe(true);
    const text = readFileSync(GRAMMAR_PATH, 'utf8');
    const parsed = JSON.parse(text) as { scopeName?: string };
    expect(parsed.scopeName).toBe('source.fsl');
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
