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
    include: ['src/**/*.spec.ts'],
    exclude: ['dist/**', 'node_modules/**', 'src/**/e2e/**'],
    // Restored 2026-07-12 (final-review I2): the port-era comment that lived
    // here said thresholds would return "once Tasks 4/7 make the entry points
    // testable" — they have (87.5%/85.48%/74.35%/89.54% stmt/branch/func/line
    // measured across four runs; see .superpowers/sdd/final-review-report.md's
    // "Fix wave" section for the full measurement, including the run-to-run
    // variance discovered while choosing these numbers). Values below are set
    // a safe margin under the *lowest* observed run, not the average, because
    // extension.ts's real (non-fake-timer) 120ms debounce makes a couple of
    // branches racily covered depending on system load.
    passWithNoTests: false,
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.stoch.ts', 'src/**/*.mutat.ts', 'src/**/e2e/**'],
      all: true,
      thresholds: {
        statements: 84,
        branches: 80,
        functions: 68,
        lines: 86
      }
    },
    globals: true
  },

});
