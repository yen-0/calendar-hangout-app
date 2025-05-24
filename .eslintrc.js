module.exports = {
  // … your existing parser, extends, plugins, etc.

  overrides: [
    // — JavaScript & JSX files —
    {
      files: ["*.js", "*.jsx"],
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      rules: {
        // if you need to tweak any JS‐only rules, do it here
      },
    },

    // — TypeScript & TSX files —
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
        sourceType: "module",
        ecmaVersion: 2022,
        ecmaFeatures: { jsx: true },
      },
      plugins: ["@typescript-eslint"],
      extends: [
        "plugin:@typescript-eslint/recommended",
        // only if you want type‐aware rules:
        "plugin:@typescript-eslint/recommended-requiring-type-checking"
      ],
      rules: {
        // common tweaks:
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { argsIgnorePattern: "^_" }
        ],
        // add any project-specific rule overrides here
      },
    },

    // — Tests (if you have Jest/Mocha/etc) —
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
      env: { jest: true },
      plugins: ["jest"],
      extends: ["plugin:jest/recommended"],
      rules: {
        // e.g. turn off no-magic-numbers in tests
        "no-magic-numbers": "off",
      },
    },
  ],
};
