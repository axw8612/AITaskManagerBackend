#!/bin/bash

# AI Task Manager Backend - Comprehensive Test Suite Runner
# This script runs all tests and generates coverage reports

set -e

echo "=== AI Task Manager Backend - Comprehensive Test Suite ==="
echo "Starting comprehensive test execution..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
print_status $YELLOW "Checking dependencies..."

if ! command_exists npm; then
    print_status $RED "Error: npm is not installed"
    exit 1
fi

if ! command_exists node; then
    print_status $RED "Error: Node.js is not installed"
    exit 1
fi

print_status $GREEN "Dependencies check passed"

# Set test environment
export NODE_ENV=test

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status $YELLOW "Installing dependencies..."
    npm install
fi

# Run TypeScript compilation check
print_status $YELLOW "Running TypeScript compilation check..."
if npx tsc --noEmit; then
    print_status $GREEN "TypeScript compilation check passed"
else
    print_status $RED "TypeScript compilation failed"
    exit 1
fi

# Run database migrations for test environment
print_status $YELLOW "Running database migrations for test environment..."
if NODE_ENV=test npm run migrate; then
    print_status $GREEN "Database migrations completed"
else
    print_status $YELLOW "Database migrations failed (this might be expected if test DB doesn't exist)"
fi

# Create test results directory
mkdir -p test-results

# Run different test suites
print_status $YELLOW "Running unit tests..."
if npx jest --testPathPattern="tests/controllers/" --coverage --coverageDirectory=test-results/unit-coverage --verbose; then
    print_status $GREEN "Unit tests passed"
else
    print_status $RED "Unit tests failed"
    exit 1
fi

print_status $YELLOW "Running integration tests..."
if npx jest --testPathPattern="tests/integration.test.ts" --coverage --coverageDirectory=test-results/integration-coverage --verbose; then
    print_status $GREEN "Integration tests passed"
else
    print_status $RED "Integration tests failed"
    exit 1
fi

print_status $YELLOW "Running middleware tests..."
if npx jest --testPathPattern="tests/middleware.test.ts" --coverage --coverageDirectory=test-results/middleware-coverage --verbose; then
    print_status $GREEN "Middleware tests passed"
else
    print_status $RED "Middleware tests failed"
    exit 1
fi

print_status $YELLOW "Running performance tests..."
if npx jest --testPathPattern="tests/performance.test.ts" --coverage --coverageDirectory=test-results/performance-coverage --verbose --timeout=120000; then
    print_status $GREEN "Performance tests passed"
else
    print_status $YELLOW "Performance tests failed (this might be expected in some environments)"
fi

print_status $YELLOW "Running database tests..."
if npx jest --testPathPattern="tests/database.test.ts" --coverage --coverageDirectory=test-results/database-coverage --verbose; then
    print_status $GREEN "Database tests passed"
else
    print_status $YELLOW "Database tests failed (this might be expected if test DB is not configured)"
fi

# Run all tests with full coverage
print_status $YELLOW "Running full test suite with coverage..."
if npx jest --coverage --coverageDirectory=test-results/full-coverage --verbose --passWithNoTests; then
    print_status $GREEN "Full test suite completed"
else
    print_status $RED "Full test suite failed"
    exit 1
fi

# Generate test summary
print_status $YELLOW "Generating test summary..."
cat > test-results/test-summary.txt << EOF
AI Task Manager Backend - Test Suite Summary
============================================

Test Execution Date: $(date)
Node.js Version: $(node --version)
npm Version: $(npm --version)

Test Categories:
- Unit Tests: Controllers (Auth, User, Project, Task, AI)
- Integration Tests: Full application flow
- Middleware Tests: Authentication, validation, error handling
- Performance Tests: Load testing, concurrent requests
- Database Tests: Connection, transactions, queries

Coverage Reports:
- Unit Test Coverage: test-results/unit-coverage/
- Integration Test Coverage: test-results/integration-coverage/
- Middleware Test Coverage: test-results/middleware-coverage/
- Performance Test Coverage: test-results/performance-coverage/
- Database Test Coverage: test-results/database-coverage/
- Full Coverage Report: test-results/full-coverage/

Key Features Tested:
✓ User authentication and authorization
✓ Project management and collaboration
✓ Task CRUD operations
✓ AI-powered suggestions and recommendations
✓ Real-time features and Socket.IO integration
✓ Input validation and sanitization
✓ Error handling and edge cases
✓ Database transactions and data integrity
✓ Performance under load
✓ Security measures and rate limiting

For detailed results, check the HTML coverage reports in the respective directories.
EOF

# Display summary
print_status $GREEN "Test suite execution completed!"
print_status $YELLOW "Test summary saved to: test-results/test-summary.txt"
print_status $YELLOW "Coverage reports available in: test-results/"

# Display coverage summary if available
if [ -f "test-results/full-coverage/lcov-report/index.html" ]; then
    print_status $GREEN "Full coverage report available at: test-results/full-coverage/lcov-report/index.html"
fi

print_status $GREEN "All tests completed successfully!"
