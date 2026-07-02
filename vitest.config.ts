
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
