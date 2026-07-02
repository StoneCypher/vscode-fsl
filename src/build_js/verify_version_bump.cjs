/**
 * Verifies that package.json's version is ahead of the most recent git tag,
 * i.e. that the version was bumped before a release.
 *
 * Rewritten for vscode-fsl, which ships as a VSIX and is never published to
 * npm — so the template's `npm view <name> version` check (which throws on an
 * unpublished package) cannot be used. Instead this compares the local version
 * against the latest semver git tag:
 *
 *   - No tags yet (first release ever)          → pass (exit 0).
 *   - Local version  >  latest tag              → pass (exit 0); version bumped.
 *   - Local version === latest tag              → fail (exit 1); not bumped.
 *   - Local version  <  latest tag              → fail (exit 1); regression.
 *
 * The release CI job does the actual tagging/releasing; this script only
 * gates it, so it neither writes tags nor needs git identity configured. It is
 * dependency-free (a tiny inline semver comparator) so it runs in a bare CI
 * checkout.
 *
 * @example
 *   // Invoked directly by the verify-version-bump CI job:
 *   node ./src/build_js/verify_version_bump.cjs
 *   // exit 0 when the version leads the latest tag (or there are no tags)
 */

const { execFileSync } = require('child_process'),
      { readFileSync } = require('fs');

/**
 * Parse a semver-ish string ("1.2.3" or "v1.2.3") into numeric [major, minor,
 * patch]. Any missing or non-numeric component becomes 0; pre-release/build
 * suffixes are ignored (sufficient for the bump gate).
 *
 * @param {string} raw - The version or tag string.
 * @returns {[number, number, number] | null} The triple, or null if unparseable.
 */
function parseSemver(raw) {
  const m = String(raw).trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) { return null; }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Compare two semver triples. Returns 1 if a > b, -1 if a < b, 0 if equal.
 *
 * @param {[number, number, number]} a
 * @param {[number, number, number]} b
 * @returns {number}
 */
function compareSemver(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) { return 1; }
    if (a[i] < b[i]) { return -1; }
  }
  return 0;
}

/**
 * Return the highest semver git tag in the repo, or null when there are none.
 *
 * @returns {string | null}
 */
function latestTag() {
  let out;
  try {
    out = execFileSync('git', ['tag', '--list', '--sort=-v:refname'], { encoding: 'utf8' });
  } catch {
    return null;
  }
  const tags = out.split(/\r?\n/).map(t => t.trim()).filter(Boolean);
  return tags.length > 0 ? tags[0] : null;
}

const priv_version = JSON.parse(readFileSync('./package.json', 'utf8')).version;
const priv = parseSemver(priv_version);

if (priv === null) {
  console.log(`Invalid package.json version: ${priv_version}`);
  process.exit(1);
}

const tag = latestTag();

if (tag === null) {
  console.log(`No git tags found; treating ${priv_version} as the first release ☑`);
  process.exit(0);
}

const pub = parseSemver(tag);

if (pub === null) {
  console.log(`Latest tag "${tag}" is not a semver tag; treating as first release ☑`);
  process.exit(0);
}

const cmp = compareSemver(priv, pub);

if (cmp > 0) {
  console.log(`Version is updated; passing ☑\n  (latest tag ${tag}, local ${priv_version})`);
  process.exit(0);
}

if (cmp === 0) {
  console.log(`Version unchanged: local ${priv_version} equals latest tag ${tag}`);
} else {
  console.log(`Version regression: local ${priv_version} is behind latest tag ${tag}`);
}

process.exit(1);
