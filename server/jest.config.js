module.exports = {
  testMatch:   ['**/tests/**/*.test.js'],
  testEnvironment: 'node',
  testTimeout: 30000,
  // Run test files serially so each file's beforeAll/afterAll don't race on DB
  maxWorkers: 1,
};
