export default {
  testEnvironment: "node",
  testMatch: ["**/*.test.js"],
  transform: {},
  moduleFileExtensions: ["js"],
  setupFilesAfterEnv: ["<rootDir>/test/setup.js"],
  testTimeout: 30000,
  verbose: true
};
