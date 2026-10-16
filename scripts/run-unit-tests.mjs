#!/usr/bin/env node
// Discovers and runs the pure-logic unit tests with Node's built-in test runner.
//
//   node scripts/run-unit-tests.mjs            # run everything
//   node scripts/run-unit-tests.mjs week-cycle # only files whose path contains "week-cycle"
//
// Test files: any `*.test.ts` under src/ or test/. Only modules that do not import React Native,
// Expo or the "@/" alias can run here (Node cannot resolve them); keep tests to pure logic.
// `--experimental-strip-types` is required on Node 22.6-22.17 and is accepted (no-op) on Node 24+.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const filter = process.argv[2];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

const files = [...walk(join(root, 'src')), ...walk(join(root, 'test'))]
  .map((f) => relative(root, f))
  .filter((f) => !filter || f.includes(filter))
  .sort();

if (files.length === 0) {
  console.error('No unit test files found.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--no-warnings', '--test', ...files],
  { cwd: root, stdio: 'inherit' }
);
process.exit(result.status ?? 1);
