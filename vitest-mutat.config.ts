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

import { defineConfig } from 'vitest/config';



export default defineConfig({

  test: {
    // 2026-07-16: this is Stryker's vitest-runner config (stryker.config.json),
    // and mutants must be exercised by the real unit suite — the previous
    // mutat-only include matched ZERO files, so Stryker's initial dry run
    // executed no tests and the CI job aborted ("No tests were executed",
    // first main-pipeline run). Unit specs are the mutation-testing suite;
    // *.mutat.ts stays included for any future mutation-specific tests.
    include: ['src/**/*.spec.ts', 'src/**/*.mutat.ts'],
    exclude: ['dist/**', 'node_modules/**', 'src/**/e2e/**'],
    passWithNoTests: false,
    // No coverage.thresholds here: Stryker disables coverage in its runner,
    // and this config's standalone `just_test` leg measures nothing the unit
    // config doesn't already gate.
    coverage: {
      enabled: true,
      reportsDirectory: './coverage-mutat',
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.stoch.ts', 'src/**/*.mutat.ts', 'src/**/e2e/**'],
      all: true
    },
    globals: true
  },

});
