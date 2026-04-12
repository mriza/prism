/**
 * Fixed Test Runner for Puppeteer E2E Tests
 */

import puppeteer from 'puppeteer';

// Global state
global.browser = null;
global.page = null;
global.passedCount = 0;
global.failedCount = 0;

// Store test suites
let testSuites = [];
let currentSuite = null;
let globalBeforeAll = null;
let globalBeforeEach = null;
let globalAfterEach = null;
let globalAfterAll = null;

// Global test functions
global.describe = (name, fn) => {
  console.log(`\n📋 Suite: ${name}`);
  currentSuite = { name, fn, tests: [], beforeAll: null, beforeEach: null, afterEach: null, afterAll: null };
  testSuites.push(currentSuite);
  fn(); // Execute to register tests
};

global.beforeAll = async (fn) => {
  if (currentSuite) {
    currentSuite.beforeAll = fn;
  }
  globalBeforeAll = fn;
};

global.beforeEach = async (fn) => {
  if (currentSuite) {
    currentSuite.beforeEach = fn;
  }
  globalBeforeEach = fn;
};

global.afterEach = async (fn) => {
  if (currentSuite) {
    currentSuite.afterEach = fn;
  }
  globalAfterEach = fn;
};

global.afterAll = async (callback) => {
  if (typeof callback === 'function' && currentSuite) {
    currentSuite.afterAll = callback;
  }
  globalAfterAll = callback;
};

// Cleanup function
async function cleanup() {
  if (global.browser) {
    console.log('   🛑 Closing browser...');
    try {
      await global.browser.close();
    } catch (e) {
      // Ignore close errors
    }
    global.browser = null;
  }
}

global.test = async (name, fn) => {
  if (currentSuite) {
    currentSuite.tests.push({ name, fn });
  }
};

global.expect = (value) => ({
  toBe: (expected) => {
    if (value !== expected) {
      throw new Error(`Expected ${expected} but got ${value}`);
    }
  },
  toMatch: (pattern) => {
    if (!pattern.test(String(value))) {
      throw new Error(`Expected ${value} to match ${pattern}`);
    }
  },
  toBeTruthy: () => {
    if (!value) {
      throw new Error(`Expected truthy value`);
    }
  },
  toBeLessThan: (expected) => {
    if (!(value < expected)) {
      throw new Error(`Expected ${value} to be less than ${expected}`);
    }
  }
});

// Execute a single test suite
async function executeSuite(suite) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${suite.name}`);
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  // Run beforeAll
  if (suite.beforeAll) {
    try {
      console.log('   🚀 Setup...');
      await suite.beforeAll();
    } catch (error) {
      console.error('   ❌ beforeAll failed:', error.message);
      suite.afterAll && await suite.afterAll();
      return { passed: 0, failed: suite.tests.length };
    }
  }

  // Run each test
  for (const testObj of suite.tests) {
    try {
      // Run beforeEach
      if (suite.beforeEach) {
        await suite.beforeEach();
      }

      await testObj.fn();
      console.log(`   ✅ ${testObj.name}`);
      passed++;
    } catch (error) {
      console.error(`   ❌ ${testObj.name}:`, error.message);
      failed++;
    }

    // Run afterEach
    if (suite.afterEach) {
      try {
        await suite.afterEach();
      } catch (error) {
        // Ignore afterEach errors
      }
    }
  }

  // Run afterAll and cleanup
  if (suite.afterAll) {
    try {
      await suite.afterAll();
    } catch (error) {
      // Ignore afterAll errors
    }
  }
  await cleanup();

  console.log(`\n✅ ${suite.name} completed (${passed}/${suite.tests.length} passed)`);
  return { passed, failed };
}

// Run all test suites
export async function runTests(testFiles) {
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };

  for (const file of testFiles) {
    testSuites = [];
    currentSuite = null;

    try {
      const cleanFile = file.replace('tests/', '');
      await import(`./${cleanFile}`);

      for (const suite of testSuites) {
        const result = await executeSuite(suite);
        results.passed += result.passed;
        results.failed += result.failed;
      }
    } catch (error) {
      console.error(`\n❌ ${file} failed:`, error.message);
      results.failed++;
    }
  }

  results.total = results.passed + results.failed;
  return results;
}
