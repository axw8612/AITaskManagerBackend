# Package Scripts Reference

This document provides a comprehensive reference for all npm scripts available in the AI Task Management Assistant backend project.

## Available Scripts

### Development Scripts

#### `npm run dev`
Starts the development server with hot reloading using ts-node-dev.

```bash
npm run dev
```

**What it does:**
- Starts the server in development mode
- Watches for file changes and automatically restarts
- Enables TypeScript compilation on-the-fly
- Sets NODE_ENV to development (if not set)

**Usage:** Primary command for local development

---

#### `npm run build`
Compiles TypeScript source code to JavaScript.

```bash
npm run build
```

**What it does:**
- Compiles all TypeScript files in `src/` to JavaScript in `dist/`
- Performs type checking
- Generates source maps
- Optimizes for production

**Usage:** Required before production deployment

---

#### `npm start`
Starts the production server from compiled JavaScript.

```bash
npm start
```

**What it does:**
- Runs the compiled application from `dist/index.js`
- Expects the application to be built first
- Used in production environments

**Prerequisites:** Run `npm run build` first

---

### Testing Scripts

#### `npm test`
Runs the complete test suite.

```bash
npm test
```

**What it does:**
- Executes all test files using Jest
- Runs tests in parallel for performance
- Provides basic coverage information
- Fails if any test fails

---

#### `npm run test:watch`
Runs tests in watch mode for development.

```bash
npm run test:watch
```

**What it does:**
- Runs tests and watches for file changes
- Re-runs affected tests automatically
- Interactive mode with filtering options
- Ideal for test-driven development

---

#### `npm run test:coverage`
Runs tests with comprehensive coverage reporting.

```bash
npm run test:coverage
```

**What it does:**
- Executes all tests
- Generates detailed coverage reports
- Creates HTML coverage report
- Enforces coverage thresholds

**Output:** Coverage reports in `coverage/` directory

---

#### `npm run test:unit`
Runs only unit tests (controller tests).

```bash
npm run test:unit
```

**What it does:**
- Executes tests in `src/tests/controllers/` directory
- Focuses on individual component testing
- Faster than full test suite
- Useful for component-specific development

---

#### `npm run test:integration`
Runs integration tests.

```bash
npm run test:integration
```

**What it does:**
- Executes full application workflow tests
- Tests API endpoints end-to-end
- Verifies system integration
- Includes database interactions

---

#### `npm run test:middleware`
Runs middleware-specific tests.

```bash
npm run test:middleware
```

**What it does:**
- Tests authentication middleware
- Tests validation middleware
- Tests error handling middleware
- Tests security middleware

---

#### `npm run test:performance`
Runs performance and load tests.

```bash
npm run test:performance
```

**What it does:**
- Executes performance benchmarks
- Tests concurrent request handling
- Measures response times
- Validates system under load
- Has extended timeout (120 seconds)

---

#### `npm run test:database`
Runs database-specific tests.

```bash
npm run test:database
```

**What it does:**
- Tests database connections
- Tests transaction handling
- Tests query performance
- Tests migration/rollback scenarios

---

#### `npm run test:all`
Runs the comprehensive test suite using the test runner script.

```bash
npm run test:all
```

**What it does:**
- Executes `./run-tests.sh` script
- Runs all test categories sequentially
- Generates comprehensive coverage reports
- Creates test summary
- Checks for test failures

---

### Database Scripts

#### `npm run migrate`
Runs database migrations to the latest version.

```bash
npm run migrate
```

**What it does:**
- Executes all pending database migrations
- Updates database schema to latest version
- Creates tables, indexes, and constraints
- Safe to run multiple times (idempotent)

**Environment:** Uses current NODE_ENV database configuration

---

#### `npm run migrate:rollback`
Rolls back the last batch of migrations.

```bash
npm run migrate:rollback
```

**What it does:**
- Reverts the most recent migration batch
- Removes tables/columns added in last migration
- Used for undoing problematic migrations
- **Warning:** Can cause data loss

**Usage:** Only in development or for emergency rollbacks

---

#### `npm run seed`
Seeds the database with initial/test data.

```bash
npm run seed
```

**What it does:**
- Inserts predefined data into database tables
- Creates test users, projects, and tasks
- Useful for development and testing
- Safe to run multiple times (usually truncates first)

**Environment:** Typically used in development/test environments

---

### Code Quality Scripts

#### `npm run lint`
Runs ESLint to check code quality and style.

```bash
npm run lint
```

**What it does:**
- Analyzes TypeScript files for style issues
- Checks for potential bugs and anti-patterns
- Enforces coding standards
- Reports issues but doesn't fix them

**Configuration:** Uses `.eslintrc.js` configuration

---

#### `npm run lint:fix`
Runs ESLint and automatically fixes issues where possible.

```bash
npm run lint:fix
```

**What it does:**
- Runs ESLint analysis
- Automatically fixes formatting issues
- Fixes auto-fixable rule violations
- Reports remaining issues that need manual attention

**Usage:** Run before committing code

---

## Script Combinations

### Common Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. Set up database
npm run migrate
npm run seed

# 3. Start development server
npm run dev

# 4. In another terminal, run tests in watch mode
npm run test:watch
```

### Pre-commit Workflow

```bash
# 1. Run linter and fix issues
npm run lint:fix

# 2. Run full test suite
npm run test:all

# 3. Build to ensure no compilation errors
npm run build
```

### Production Deployment Workflow

```bash
# 1. Install production dependencies
npm ci --only=production

# 2. Build application
npm run build

# 3. Run database migrations
npm run migrate

# 4. Start production server
npm start
```

### Testing Workflow

```bash
# Quick test run
npm test

# Comprehensive testing with coverage
npm run test:coverage

# Performance validation
npm run test:performance

# Full validation suite
npm run test:all
```

## Environment-Specific Usage

### Development Environment

```bash
# Primary commands for local development
npm run dev          # Start dev server
npm run test:watch   # Run tests continuously
npm run lint:fix     # Fix code style issues
```

### Staging Environment

```bash
# Commands for staging deployment
npm run build        # Build for staging
npm run migrate      # Update database
npm run test         # Run full test suite
npm start           # Start staging server
```

### Production Environment

```bash
# Commands for production deployment
npm ci --only=production  # Install production deps
npm run build            # Build optimized version
npm run migrate          # Update production database
npm start               # Start production server
```

## Troubleshooting

### Common Issues

1. **Tests failing after dependency updates**
   ```bash
   # Clear Jest cache and reinstall
   npx jest --clearCache
   rm -rf node_modules package-lock.json
   npm install
   npm test
   ```

2. **Build failures**
   ```bash
   # Check TypeScript errors
   npx tsc --noEmit
   
   # Clean build directory
   rm -rf dist/
   npm run build
   ```

3. **Database migration issues**
   ```bash
   # Check migration status
   npx knex migrate:status
   
   # Rollback if needed
   npm run migrate:rollback
   npm run migrate
   ```

4. **Linting errors**
   ```bash
   # Try auto-fix first
   npm run lint:fix
   
   # Check remaining issues
   npm run lint
   ```

### Performance Tips

1. **Parallel Testing**: Jest runs tests in parallel by default
2. **Watch Mode**: Use watch mode during development for faster feedback
3. **Selective Testing**: Run specific test suites during focused development
4. **Linting**: Fix linting issues early to avoid build problems

## Custom Script Configuration

### Adding New Scripts

To add custom scripts to `package.json`:

```json
{
  "scripts": {
    "custom:script": "your-command-here",
    "db:reset": "npm run migrate:rollback && npm run migrate && npm run seed",
    "test:specific": "jest --testPathPattern=specific-test-file"
  }
}
```

### Script Dependencies

Some scripts have dependencies on others:

- `npm start` requires `npm run build`
- `npm run migrate` should run before `npm run seed`
- `npm run test:all` runs multiple test suites

### Environment Variables

Scripts respect environment variables:

- `NODE_ENV`: Affects database connections and logging
- `PORT`: Changes server port
- `LOG_LEVEL`: Controls logging verbosity

This comprehensive script reference should help you navigate and use all available npm commands effectively in the AI Task Management Assistant backend project.
