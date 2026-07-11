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
    // Coverage is collected for reporting (update_madlibs parses the summary);
    // numeric thresholds are intentionally not enforced during the port — the
    // extension entry points are stubs until later plan tasks add their tests.
    passWithNoTests: true,
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.stoch.ts', 'src/**/*.mutat.ts', 'src/**/e2e/**'],
      all: true
    },
    globals: true
  },

});
