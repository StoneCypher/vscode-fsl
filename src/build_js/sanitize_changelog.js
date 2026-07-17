/**
 * Escapes raw HTML/XML-ish tag openers in the generated changelog files so
 * `vsce package` cannot be broken by a commit body that happens to contain
 * literal markup (e.g. a commit message quoting `<svg>...</svg>`).
 *
 * better_git_changelog copies commit-message bodies into CHANGELOG.md and
 * CHANGELOG.long.md verbatim. vsce rejects any SVG (or other disallowed)
 * tags it finds in CHANGELOG.md, which otherwise fails packaging on commits
 * whose bodies happen to contain such text. This pass runs right after
 * better_git_changelog regenerates those files and before they are copied
 * into src/doc_md/, so both the repo-root and doc copies are sanitized.
 *
 * @example
 *   // Invoked by the `changelog` npm script:
 *   node src/build_js/sanitize_changelog.js
 *   // Rewrites CHANGELOG.md and CHANGELOG.long.md (if present) in place
 */

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

const CHANGELOG_FILES = ['CHANGELOG.md', 'CHANGELOG.long.md'];

/**
 * Escapes every `<` that opens what looks like an HTML/XML tag — a letter,
 * `/`, or `!` immediately following it — while leaving everything else (math
 * comparisons like `a < b`, arrows, plain text) untouched.
 *
 * In ordinary prose text, Markdown decodes `&lt;` back to a literal `<`, so
 * escaping there does not change how the changelog displays; it only stops
 * tag-sniffing tools like `vsce` from seeing an opening tag. That is NOT
 * true inside a backticked code span or fenced code block: Markdown does not
 * decode entities there, so a commit message quoting `` `<svg>` `` displays
 * as the literal text `&lt;svg>` after sanitization (see
 * `sanitize_changelog.spec.ts`'s "escapes a tag inside a backticked code
 * span" case). That display cost is the accepted trade-off — `vsce` tag-
 * sniffs inside code spans too, so they must be sanitized the same as prose.
 *
 * @param text - Markdown content to sanitize
 * @returns The same text with tag-opening `<` characters escaped to `&lt;`
 *
 * @example
 *   sanitize_markdown_tags('<svg width="1">'); // '&lt;svg width="1">'
 *   sanitize_markdown_tags('a < b');           // 'a < b' (unchanged)
 */
export function sanitize_markdown_tags(text) {
  return text.replace(/<(?=[a-zA-Z/!])/g, '&lt;');
}

/**
 * Reads a changelog file, sanitizes it, and writes it back in place. Missing
 * files are skipped silently since CHANGELOG.long.md is not always present.
 *
 * @param name - Changelog filename, relative to the project root
 * @returns Resolves once the file has been rewritten, or skipped if absent
 */
async function sanitizeOne(name) {
  const path = join(PROJECT_ROOT, name);
  let content;
  try {
    content = await readFile(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  await writeFile(path, sanitize_markdown_tags(content), 'utf8');
}

async function main() {
  await Promise.all(CHANGELOG_FILES.map(sanitizeOne));
}

// Run only when invoked directly, never when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
