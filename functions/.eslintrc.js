// functions/.eslintrc.js - SUGGESTED STATE
module.exports = {
  root: true, // Stops ESLint from looking in parent folders
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    // Add "plugin:import/errors", "plugin:import/warnings", "plugin:import/typescript" if you use eslint-plugin-import
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"], // Adjust if your tsconfig files are named differently
    sourceType: "module",
    ecmaVersion: 2020, // Or a newer version if you use its features
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/node_modules/**/*",
    ".eslintrc.js", // Often good to ignore the ESLint config itself from linting
  ],
  plugins: [
    "@typescript-eslint",
    "import", // if you use it
  ],
  rules: {
    "quotes": ["error", "double"], // Example: enforce double quotes
    "import/no-unresolved": 0, // Can be problematic with Firebase structure sometimes
    "indent": ["error", 2], // Example: 2 space indent
    "object-curly-spacing": ["error", "always"], // Example: require spaces inside braces
    "max-len": ["error", { "code": 120 }], // Example: increase max line length
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }], // Warn for unused vars, ignore if prefixed with _
    "@typescript-eslint/no-explicit-any": "warn", // Warn on "any"
    // Add or adjust other rules as needed
  },
};