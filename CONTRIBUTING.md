# Contributing

This project is MIT licensed. Contributions are welcome.

## Table of contents

- [How do I set up my development environment?](#how-do-i-set-up-my-development-environment)
- [How do I add a function?](#how-do-i-add-a-function)
- [How do I run tests?](#how-do-i-run-tests)
- [How do I add a unit test?](#how-do-i-add-a-unit-test)
- [How do I add a stochastic test?](#how-do-i-add-a-stochastic-test)
- [How do I add an E2E test?](#how-do-i-add-an-e2e-test)
- [How do I run the linter?](#how-do-i-run-the-linter)
- [How do I build the project?](#how-do-i-build-the-project)
- [How do I write documentation?](#how-do-i-write-documentation)
- [How do I write a commit message?](#how-do-i-write-a-commit-message)
- [How do I submit a pull request?](#how-do-i-submit-a-pull-request)

---

## How do I set up my development environment?

Clone the repo, install dependencies, and run a full build to verify everything works.

```bash
git clone <repo-url>
cd <repo-name>
npm install
npm run build
```

You need Node 23 or 24 (the versions CI tests against). No other prerequisites beyond Node and npm.

---

## How do I add a function?

Every function needs source code, documentation, and a unit test.

1. Write the function in a file under `src/` — this is a flat layout, not a package with a curated export surface: extension-host code lives directly under `src/` (`extension.ts`, `fence_plugin.ts`, `render_queue.ts`, `render_machine.ts`, `svg_cache.ts`), and webview/preview code lives under `src/preview/`. Add new files alongside whichever of those two areas the function belongs to, and import it directly from wherever it's needed (`extension.ts`, `preview.ts`, etc.) — there is no central `index.ts` to re-export from.
2. Add a DocBlock (see [How do I write documentation?](#how-do-i-write-documentation)).
3. Create a unit test in `src/tests/<name>.spec.ts`.
4. Add a stochastic test in `src/tests/<name>.stoch.ts` *when the function's correctness can be expressed as a property* — see [How do I add a stochastic test?](#how-do-i-add-a-stochastic-test). Not every function needs one; a pure hash function or cache key builder is a good candidate, a thin VS Code activation hook usually isn't.
5. Update `base_README.md` if the function changes the extension's documented, user-facing behavior (the fence grammar, error handling, theming, etc.) — most internal functions don't need a README mention.

For a complete example of this pattern, look at `src/svg_cache.ts` (`fnv1a`, `svg_cache_key`) and its tests in `src/tests/svg_cache.spec.ts`.

**Gotcha:** Never edit `README.md` directly. It is generated from `base_README.md` at build time by the madlibs system (`update_madlibs`). Always edit `base_README.md` instead.

---

## How do I run tests?

| Category | Files | Tool | Run with |
|---|---|---|---|
| Unit | `src/tests/*.spec.ts` | vitest | `npx vitest run` |
| Stochastic | `src/tests/*.stoch.ts` | vitest + fast-check | `npx vitest run --config vitest-stoch.config.ts` |
| E2E | `src/tests/e2e/*.spec.ts` | Playwright | `npm run build && node src/build_js/hosted_test.js` |

`npm run just_test` runs all three vitest configs (unit, stochastic, and the currently-empty mutation config used by Stryker) back to back with coverage.

Coverage thresholds on the unit suite (`vitest.config.ts`) are 84% statements, 80% branches, 68% functions, 86% lines. The stochastic and mutation configs don't enforce thresholds yet — each carries a dated comment explaining why (in short: the stochastic suite's one test today exercises a `.js` build script outside that config's `.ts`-only coverage surface, and the mutation config has no `*.mutat.ts` files yet — it exists to be Stryker's vitest-runner config, not a suite of its own).

Tests also run as part of `npm run build` (via the mandatory `just_test_save` stage, unit + stochastic only) — a failing test fails the build. Mutation testing (`npm run stryker`) is not part of the local build gate; it runs as its own CI job.

There are no E2E specs in this repo yet — `src/tests/e2e/` is wired up (`playwright.config.ts`, `hosted_test.js`) and ready for the first one.

---

## How do I add a unit test?

Create a file at `src/tests/<name>.spec.ts`.

```ts
import { myFunction } from '../myModule.js';

describe('myFunction', () => {
  test('returns the expected result', () => {
    expect(myFunction(2)).toBe(4);
  });
});
```

Import source files using the `.js` extension — this is the TypeScript ESM module resolution convention. Adjust the relative path to match where the module actually lives (e.g. `'../preview/hydrate.js'` for a `src/preview/` module).

**Gotcha:** No fake tests. A fake test computes the expected output and then checks that, instead of exercising the actual function. Every test must call the real function and assert against a known-correct value.

---

## How do I add a stochastic test?

Create a file at `src/tests/<name>.stoch.ts`. Stochastic tests use [fast-check](https://github.com/dubzzz/fast-check) for property-based testing.

```ts
import * as fc    from 'fast-check';
import { myFunction } from '../myModule.js';

describe('myFunction stochastic', () => {
  test('always returns a positive number for positive input', () => {
    fc.assert(
      fc.property(fc.float({ min: 1 }), (n: number) => {
        expect(myFunction(n)).toBeGreaterThan(0);
      })
    );
  });
});
```

Use stochastic tests when a function's correctness can be expressed as a property that holds for all valid inputs — for example, "encoding then decoding is identity", "output is always a number", or "result is never negative for positive input". `src/tests/build_config.stoch.ts` (property tests over the build orchestrator's stage-planning invariants) is the working example in this repo today.

Stochastic coverage is reported separately in `coverage-stoch/`.

---

## How do I add an E2E test?

Create test files in `src/tests/e2e/`. E2E tests use Playwright and run against the built site.

```ts
import { test, expect } from '@playwright/test';

test.describe('/my-page.html', () => {
  test('returns a 200 status', async ({ page }) => {
    const response = await page.goto('/my-page.html');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
  });
});
```

E2E tests are separate from the main build. Build first, then run them:

```bash
npm run build
node src/build_js/hosted_test.js
```

The test harness starts a local `servehere` instance on port 15512 serving `docs/`, runs Playwright against it, and tears the server down when finished (`playwright.config.ts` points `testDir` at `src/tests/e2e`).

---

## How do I run the linter?

```bash
npm run eslint
```

ESLint is configured with strict, type-checked rules for:

- **TypeScript** (`.ts`, `.mts`, `.cts`) — `strictTypeChecked` + `stylisticTypeChecked`
- **JavaScript** (`.js`, `.mjs`, `.cjs`) — recommended rules, no type checking
- **Markdown** (`.md`) — GFM recommended rules
- **CSS** (`.css`) — recommended rules

Linting also runs as part of `npm run build`. Test files (`*.spec.*`, `*.stoch.*`, `*.mutat.*`) are excluded from ESLint.

---

## How do I build the project?

```bash
npm run build
```

`npm run build` invokes `node src/build_js/run_build.js`, a config-driven orchestrator (`build.config.json`) that runs a sequence of stages; scripts within a stage run concurrently, stages run serially, and the build aborts if anything in a stage fails. With every optional feature enabled (the default), the stages are:

0. **clean** — wipe and recreate `build/`, `dist/`, `docs/`
1. **typescript** (`tsc -p tsconfig.src.json`, type-check + emit `.d.ts`), **typescript_tests** (`tsc -p tsconfig.tests.json`), **just_test_save** (unit + stochastic vitest suites with coverage, saved for later steps), **docs** (first TypeDoc pass), **eslint**, **cloc**, **changelog**
2. **bundle** (`src/scripts/build.mjs` — esbuild builds two bundles: `dist/extension.js`, CJS/Node with `vscode` external, and `dist/preview.js`, a self-contained browser IIFE), **dts** (copy the emitted `.d.ts` files into `dist/`), **update_madlibs** (interpolate version/coverage/doc-coverage/etc. into `README.md` from `base_README.md`)
3. **viz_png** (render bundle-composition visualizations), **terser** (minify both bundles in place, with source maps)
4. **docs** (second TypeDoc pass, now against the updated README), **attw** (`@arethetypeswrong/cli` — validates type resolution across module systems), **verify_dist_entrypoints** (asserts the minified `dist/extension.js` still exports callable `activate`/`deactivate`, and that `package.json` has no top-level `"type"` field — the guard added after the type:module loader incident; see `src/build_js/verify_dist_entrypoints.js`)
5. **site** (assemble `docs/`: copy HTML, README, images)

Optional features (everything except `clean`/`typescript`/`typescript_tests`/`just_test_save`/`bundle`/`dts`/`update_madlibs`/`verify_dist_entrypoints`) can be toggled via `build.config.json` profiles, `build.config.<env>.json` / `build.config.local.json` overlays, `BUILD_*` env vars, or `--enable=`/`--disable=`/`--only=`/`--profile=` CLI flags — see `src/build_js/build_config.js` and `build_config_schema.js` for the full mechanism. `--profile=fast` skips docs/eslint/cloc/changelog/viz_png/attw/site for a quick local iteration loop; `--profile=ci-lite` (used by CI's per-PR check and cross-platform matrix) skips docs/cloc/changelog/viz_png/site.

If the build passes, everything is green: tests, types, lint, bundling, minification, the entry-point/manifest guard, and type resolution.

---

## How do I write documentation?

Use DocBlock (JSDoc) format in the source. TypeDoc generates HTML documentation from these blocks.

**Required tags:**

- `@param {type} name` — description of each parameter
- `@returns {type}` — what the function returns
- `@example` — a working code example with expected output

**Recommended tags:**

- `@throws` — error conditions
- `@since` — version introduced
- `@author` — who wrote it
- `@category` — grouping in the generated docs

Show both success and failure cases in examples where applicable:

```ts
/**
 * Returns the arithmetic double of the input number.
 *
 * @param {number} x - The input value to be doubled
 * @returns {number} The doubled value
 *
 * @example
 * ```ts
 * console.log( double(3) );  // 6
 * ```
 *
 * @throws TypeError if `typeof x !== 'number'`
 *
 * @example
 * ```ts
 * double('three');  // throws TypeError
 * ```
 */
```

Documentation coverage is tracked by `typedoc-plugin-coverage`.

**Gotcha:** The README is generated. `base_README.md` contains `{{placeholders}}` like `{{version}}` and `{{coverage}}` that are filled in at build time. Always edit `base_README.md`.

---

## How do I write a commit message?

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint.

**Format:** `type(scope): description`

The scope is optional. The description should be lowercase, imperative mood, no trailing period.

**Common types:**

| Type | Use for |
|---|---|
| `feat` | A new function or feature |
| `fix` | A bug fix |
| `docs` | Documentation-only changes |
| `build` | Build system, dependencies, configuration |
| `test` | Adding or updating tests |
| `refactor` | Code changes that don't fix a bug or add a feature |
| `ci` | CI/CD configuration |
| `perf` | Performance improvements |
| `chore` | Maintenance tasks |

**Examples:**

```text
feat: add email validation function
fix: handle NaN input in double()
docs: add @throws tag to parser functions
build: upgrade vitest to v4
test: add stochastic tests for encoder
```

---

## How do I submit a pull request?

1. Create a branch from `main`.
2. Make your changes.
3. Run `npm run build` and make sure it passes.
4. Push your branch and open a PR against `main`.

CI runs a single Ubuntu/Node 24 check (`--profile=ci-lite`) on ordinary PRs; the full cross-platform matrix (Ubuntu/macOS/Windows across Node 23 and 24) plus Stryker mutation testing run on push to `main`, or on a PR whose head commit message contains `#fullbuild`. All jobs required for the event that triggered them must pass before merge.
