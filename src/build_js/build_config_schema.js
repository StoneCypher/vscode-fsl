/**
 * zod schema and feature catalog for the configurable build orchestrator.
 *
 * FEATURES is the single source of truth for which scripts the build can
 * run, whether each is mandatory or optional, what stage(s) each belongs
 * to, and which other features it requires. The zod schema is derived
 * from the OPTIONAL_FEATURE_NAMES list so the two cannot drift.
 *
 * @example
 *   import { BuildConfigSchema } from './build_config_schema.js';
 *   const cfg = BuildConfigSchema.parse(JSON.parse(text));
 */

import { z } from 'zod';

/**
 * The feature catalog. Each entry maps a feature name to its build-orchestrator
 * metadata. `stages` is an array because some features (notably `docs`) are
 * intentionally invoked at more than one stage.
 */
export const FEATURES = {
  // mandatory — always run; not toggleable
  clean:            { stages: [0], mandatory: true, script: 'clean' },
  typescript:       { stages: [1], mandatory: true, script: 'typescript' },
  typescript_tests: { stages: [1], mandatory: true, script: 'typescript_tests' },
  just_test_save:   { stages: [1], mandatory: true, script: 'just_test_save' },
  // Copies jssm's published TextMate grammar into ./syntaxes/. Only needs
  // node_modules/jssm present, so it can run alongside the other stage-1
  // features rather than waiting on the bundle/dts stages.
  copy_grammars:    { stages: [1], mandatory: true, script: 'copy_grammars' },
  bundle:           { stages: [2], mandatory: true, script: 'bundle' },
  dts:              { stages: [2], mandatory: true, script: 'dts' },
  update_madlibs:   { stages: [2], mandatory: true, script: 'update_madlibs' },
  // Not toggleable: this is the automated guard for the type:module loader
  // incident's own postmortem lesson ("test the minified artifact"). Stage 4
  // runs after stage 3's optional `terser` pass, so it inspects whatever
  // dist/extension.js the build actually produced. See verify_dist_entrypoints.js.
  verify_dist_entrypoints: { stages: [4], mandatory: true, script: 'verify_dist_entrypoints' },

  // optional — default on; can be toggled via config / env / CLI
  docs:      { stages: [1, 4], optional: true, defaultEnabled: true, script: 'docs' },
  eslint:    { stages: [1],    optional: true, defaultEnabled: true, script: 'eslint' },
  cloc:      { stages: [1],    optional: true, defaultEnabled: true, script: 'cloc' },
  changelog: { stages: [1],    optional: true, defaultEnabled: true, script: 'changelog' },
  viz_png:   { stages: [3],    optional: true, defaultEnabled: true, script: 'viz_png', requires: ['bundle'] },
  terser:    { stages: [3],    optional: true, defaultEnabled: true, script: 'terser',  requires: ['bundle'] },
  attw:      { stages: [4],    optional: true, defaultEnabled: true, script: 'attw' },
  site:      { stages: [5],    optional: true, defaultEnabled: true, script: 'site',    requires: ['docs'] },
};

export const MANDATORY_FEATURE_NAMES = Object.entries(FEATURES)
  .filter(([, def]) => def.mandatory)
  .map(([name]) => name);

export const OPTIONAL_FEATURE_NAMES = Object.entries(FEATURES)
  .filter(([, def]) => def.optional)
  .map(([name]) => name);

const featureFlagsShape = Object.fromEntries(
  OPTIONAL_FEATURE_NAMES.map(n => [n, z.boolean().optional()])
);

const FeatureFlags = z.object(featureFlagsShape).strict();

const Profile = z.object({
  features: FeatureFlags.optional(),
}).strict();

export const BuildConfigSchema = z.object({
  $schema:  z.string().optional(),
  features: FeatureFlags.optional(),
  profiles: z.record(z.string(), Profile).optional(),
}).strict();
