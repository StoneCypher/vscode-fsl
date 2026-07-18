import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Structural test: does the hand-authored markdown injection grammar exist,
 * parse as valid JSON, and carry a `fsl-code-block` fence-opening regex that
 * actually matches (and rejects) the right fence lines? This grammar is not
 * copied from jssm — unlike fsl.tmLanguage.json — so there is no upstream
 * source to trust; the regex behavior must be verified directly against
 * Node's RegExp engine here, since VS Code will parse the same pattern
 * string with Oniguruma at runtime.
 *
 * Dual-engine caveat: the begin/end patterns' `(^|\G)` alternative is an
 * Oniguruma `\G` anchor (VS Code's markdown-basics grammar uses the same
 * idiom) that Node's RegExp engine does not support — `\G` degrades to a
 * literal identity-escaped "G" character here, so that branch is inert
 * (never exercised) under every case below. What these tests actually prove
 * is string-identity with the known-good Oniguruma idiom, not full branch
 * coverage of the pattern under this engine.
 */

const PROJECT_ROOT = process.cwd();
const INJECTION_GRAMMAR_PATH = join(PROJECT_ROOT, 'syntaxes', 'fsl.markdown.injection.json');
const PACKAGE_JSON_PATH = join(PROJECT_ROOT, 'package.json');

interface InjectionGrammar {
  scopeName?: string;
  injectionSelector?: string;
  repository?: {
    'fsl-code-block'?: {
      begin?: string;
    };
  };
}

interface PackageManifest {
  contributes?: {
    grammars?: Array<{
      scopeName?: string;
      path?: string;
      injectTo?: string[];
      embeddedLanguages?: Record<string, string>;
    }>;
  };
}

describe('fsl.markdown.injection.json — structure', () => {
  const text = readFileSync(INJECTION_GRAMMAR_PATH, 'utf8');
  const parsed = JSON.parse(text) as InjectionGrammar;

  it('targets markdown via injectionSelector', () => {
    expect(parsed.injectionSelector).toContain('text.html.markdown');
  });

  it('defines a fsl-code-block begin pattern as a string', () => {
    expect(typeof parsed.repository?.['fsl-code-block']?.begin).toBe('string');
  });
});

describe('fsl-code-block begin regex — fence matching', () => {
  const text = readFileSync(INJECTION_GRAMMAR_PATH, 'utf8');
  const parsed = JSON.parse(text) as InjectionGrammar;
  const beginSource = parsed.repository?.['fsl-code-block']?.begin as string;
  const beginRegex = new RegExp(beginSource);

  it.each([
    ['```fsl'],
    ['```JSSM'],
    ['```fsl width=300'],
  ])('matches %s', (line) => {
    expect(beginRegex.test(line)).toBe(true);
  });

  it.each([
    ['```fslx'],
    ['```js'],
  ])('does not match %s', (line) => {
    expect(beginRegex.test(line)).toBe(false);
  });
});

describe('package.json — markdown injection grammar registration', () => {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as PackageManifest;
  const grammars = pkg.contributes?.grammars ?? [];
  const entry = grammars.find(g => g.scopeName === 'markdown.fsl.codeblock');

  it('registers an entry for markdown.fsl.codeblock', () => {
    expect(entry).toBeDefined();
  });

  it('points at the injection grammar file', () => {
    expect(entry?.path).toBe('./syntaxes/fsl.markdown.injection.json');
  });

  it('injects into text.html.markdown', () => {
    expect(entry?.injectTo).toContain('text.html.markdown');
  });

  it('maps the embedded content scope to source.fsl', () => {
    expect(entry?.embeddedLanguages?.['meta.embedded.block.fsl']).toBe('source.fsl');
  });
});
