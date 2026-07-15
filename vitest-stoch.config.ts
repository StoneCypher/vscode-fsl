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
    include: ['src/**/*.stoch.ts'],
    exclude: ['dist/**', 'node_modules/**', 'src/**/e2e/**'],
    // 2026-07-12 (final-review I2): a real stochastic suite exists now
    // (build_config.stoch.ts), so a glob regression that matched zero files
    // should fail loudly rather than pass silently.
    passWithNoTests: false,
    // No numeric coverage.thresholds here (deliberately, not an oversight):
    // `coverage.include` below only tracks `src/**/*.ts`, and the one
    // stochastic suite that exists today (build_config.stoch.ts) exercises
    // build_config.js — a `.js` file under src/build_js/ that this include
    // glob doesn't match at all. Measured .ts coverage from this config is
    // therefore 0% across the board by construction, not by regression;
    // thresholds would either be meaninglessly-0 or spuriously fail on the
    // first new .ts-targeting stochastic test. Revisit once a stochastic
    // test exercises a src/**/*.ts module directly.
    coverage: {
      enabled: true,
      reportsDirectory: './coverage-stoch',
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.stoch.ts', 'src/**/*.mutat.ts', 'src/**/e2e/**'],
      all: true
    },
    globals: true
  },

});
