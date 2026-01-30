# Linting and Formatting Setup Design

**Date:** 2026-01-30
**Status:** Approved

## Overview

Set up ESLint and Prettier for the AI meal planner TypeScript project with strict linting rules, automatic formatting, and pre-commit hooks to enforce code quality and consistency.

## Tooling Choices

### Core Tools
- **ESLint** - Code quality and best practices linting
- **Prettier** - Code formatting
- **Husky** - Git hooks management
- **lint-staged** - Run linters on staged files only

### Dependencies
- `eslint` - Core linting engine
- `@typescript-eslint/parser` - Parses TypeScript for ESLint
- `@typescript-eslint/eslint-plugin` - TypeScript-specific rules
- `eslint-config-prettier` - Disables ESLint formatting rules that conflict with Prettier
- `prettier` - Code formatter
- `husky` - Git hooks manager
- `lint-staged` - Run linters on staged files only

## ESLint Configuration

### Base Configuration
Extend the following presets in order:
1. `eslint:recommended` - Core JavaScript rules
2. `plugin:@typescript-eslint/recommended` - TypeScript basics
3. `plugin:@typescript-eslint/recommended-requiring-type-checking` - Strict type-aware rules
4. `eslint-config-prettier` - Disable conflicting formatting rules (must be last)

### Strict Rules
- `@typescript-eslint/no-explicit-any: error` - Ban `any` type, forces proper typing
- `@typescript-eslint/no-unused-vars: error` - Catch unused variables (with ignores for `_` prefix)
- `@typescript-eslint/explicit-function-return-type: warn` - Encourage return type annotations
- `no-console: warn` - Warn on console statements (CLI tool, so warn not error)
- `eqeqeq: error` - Require strict equality (`===` not `==`)

### Parser Configuration
- Use `@typescript-eslint/parser` with `tsconfig.json` for type-aware linting
- Include test files in linting

## Prettier Configuration

### Formatting Options
- `semi: true` - Use semicolons
- `singleQuote: true` - Single quotes for strings
- `trailingComma: 'es5'` - Trailing commas where valid in ES5
- `tabWidth: 2` - 2 spaces for indentation
- `printWidth: 80` - Wrap lines at 80 characters
- `arrowParens: 'always'` - Always use parens around arrow function args

### Files to Ignore
- `node_modules/`
- `dist/`
- `coverage/`
- `*.json` except package.json
- Lock files

## Pre-commit Hook Setup

### Husky
- Initialize with `npx husky init`
- Creates `.husky/` directory with pre-commit hook
- Add `prepare` script to package.json for automatic setup

### lint-staged
- Add config to package.json
- For `*.ts` files:
  1. Run `eslint --fix` to auto-fix linting issues
  2. Run `prettier --write` to format code
  3. Re-stage the fixed files
- Only runs on staged files for performance

### Commit Workflow
1. Developer stages files with `git add`
2. Developer runs `git commit`
3. Pre-commit hook triggers lint-staged
4. lint-staged runs ESLint + Prettier on staged files
5. Auto-fixes are staged automatically
6. If errors can't be fixed, commit is blocked
7. Developer fixes issues and retries

## Package Scripts

```json
{
  "lint": "eslint . --ext .ts",
  "lint:fix": "eslint . --ext .ts --fix",
  "format": "prettier --write \"src/**/*.ts\"",
  "format:check": "prettier --check \"src/**/*.ts\"",
  "prepare": "husky install"
}
```

## Implementation Steps

1. Install all dependencies
2. Create `.eslintrc.json` with strict configuration
3. Create `.prettierrc` and `.prettierignore`
4. Initialize husky and set up pre-commit hook
5. Add lint-staged config to package.json
6. Run `npm run format` to format all existing code
7. Run `npm run lint:fix` to auto-fix ESLint issues
8. Commit the setup + formatted code

## Post-Setup

- All future commits automatically lint and format staged files
- Run `npm run lint` before pushing
- Consider adding CI check for PR enforcement later
