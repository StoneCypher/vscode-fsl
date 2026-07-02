
import { defineConfig } from 'vitest/config';



export default defineConfig({

  test: {
    include: ['src/**/*.mutat.ts'],
    exclude: ['dist/**', 'node_modules/**', 'src/**/e2e/**'],
    passWithNoTests: true,
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
