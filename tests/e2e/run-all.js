/**
 * Run All E2E Tests
 */

import { runTests } from './tests/test-runner.js';

const testFiles = [
  'tests/auth.test.js',
  'tests/projects.test.js',
  'tests/dashboard.test.js'
];

console.log('Running all E2E tests...\n');

const results = await runTests(testFiles);

console.log('\n=== Test Results ===');
console.log(`Total: ${results.total}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);

process.exit(results.failed > 0 ? 1 : 0);
