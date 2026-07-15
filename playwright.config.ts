/**
 * eslint.config.js's `allowDefaultProject: ["*.config.ts"]` type-checks this
 * root `*.config.ts` file against typescript-eslint's synthesized single-file
 * "default project" rather than tsconfig.src.json/tsconfig.tests.json. That
 * default project's compiler options come from the root tsconfig.json, which
 * is a references-only solution file with no `compilerOptions` and therefore
 * no `strictNullChecks`. The four rules below refuse to run their real
 * analysis and report a structural "requires strictNullChecks" finding
 * unconditionally when that option is off — a project-wiring gap, not a code
 * defect in this file (see .superpowers/sdd/task-8-prep-report.md). Each rule
 * ships its own documented opt-out for exactly this situation, so that is
 * used here instead of disabling the rules outright.
 */
/* eslint @typescript-eslint/no-unnecessary-boolean-literal-compare: ["error", { "allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing": true }], @typescript-eslint/no-unnecessary-condition: ["error", { "allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing": true }], @typescript-eslint/no-useless-default-assignment: ["error", { "allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing": true }], @typescript-eslint/prefer-nullish-coalescing: ["error", { "allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing": true }] */

import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for e2e tests.
 *
 * Expects BASE_URL to be set by the test harness (hosted_test.js).
 * Falls back to http://localhost:15512 for local development.
 *
 * @example
 *   // Run via the build script:
 *   node src/build_js/hosted_test.js
 *
 *   // Or manually (with servehere already running):
 *   BASE_URL=http://localhost:15512 npx playwright test src/ts/e2e
 */
export default defineConfig({
  testDir: './src/tests/e2e',
  use: {
    /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition --
       under the default-project compiler options this file is linted against
       (see the file-top note), `process.env.BASE_URL` types as always-defined,
       so the rule misreads this `??` fallback as dead code. It is not:
       BASE_URL is genuinely unset outside the test harness, and this
       fallback is load-bearing. */
    baseURL: process.env.BASE_URL ?? 'http://localhost:15512',
  },
});
