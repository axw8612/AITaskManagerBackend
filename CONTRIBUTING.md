# Contributing Guide

Thank you for your interest in contributing to the AI Task Management Assistant backend! This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Guidelines](#documentation-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Release Process](#release-process)
- [Community](#community)

## Code of Conduct

This project adheres to a Code of Conduct that we expect all contributors to follow. Please read the full text to understand what actions will and will not be tolerated.

### Our Pledge

We pledge to make participation in this project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- PostgreSQL 12 or higher
- Redis 6.0 or higher
- Git

### First Steps

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/ai-task-management-backend.git
   cd ai-task-management-backend
   ```
3. **Add the upstream repository**:
   ```bash
   git remote add upstream https://github.com/original-repo/ai-task-management-backend.git
   ```

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your local configuration
nano .env
```

Required environment variables for development:
```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskmanager_dev
DB_USER=your_db_user
DB_PASSWORD=your_db_password
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-development-jwt-secret
OPENAI_API_KEY=your-openai-api-key
```

### 3. Database Setup

```bash
# Create development database
createdb taskmanager_dev

# Run migrations
npm run migrate

# Seed development data
npm run seed
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000` with hot reloading enabled.

## Project Structure

```
src/
├── cache/              # Redis cache configuration
├── config/             # Application configuration
├── controllers/        # Request handlers
├── database/           # Database configuration and migrations
│   ├── migrations/     # Database migration files
│   └── seeds/          # Database seed files
├── middleware/         # Express middleware
├── routes/             # API route definitions
├── socket/             # Socket.IO configuration
├── tests/              # Test files
│   ├── controllers/    # Controller tests
│   └── utils/          # Test utilities
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── validators/         # Input validation schemas
└── index.ts            # Application entry point
```

### Key Files

- `src/index.ts` - Application entry point
- `src/config/config.ts` - Configuration management
- `src/database/connection.ts` - Database connection setup
- `knexfile.js` - Knex database configuration
- `jest.config.js` - Jest testing configuration
- `tsconfig.json` - TypeScript configuration

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### Branch Naming Conventions

- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Critical fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test improvements

### 2. Make Your Changes

Follow the coding standards and ensure your changes:
- Are well-tested
- Follow the existing code style
- Include appropriate documentation
- Don't break existing functionality

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration

# Run tests with coverage
npm run test:coverage
```

### 4. Commit Your Changes

Use clear and descriptive commit messages:

```bash
git add .
git commit -m "feat: add user profile management endpoints

- Add GET /api/users/profile endpoint
- Add PUT /api/users/profile endpoint
- Include validation for profile updates
- Add comprehensive tests for new endpoints"
```

#### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

### 5. Keep Your Branch Updated

```bash
git fetch upstream
git rebase upstream/main
```

## Coding Standards

### TypeScript Guidelines

1. **Use strict TypeScript configuration**
   - Enable `strict` mode in `tsconfig.json`
   - Use explicit type annotations for function parameters and return types
   - Avoid `any` type unless absolutely necessary

2. **Naming Conventions**
   - Use `camelCase` for variables and functions
   - Use `PascalCase` for classes and interfaces
   - Use `UPPER_SNAKE_CASE` for constants
   - Use descriptive names

3. **Code Organization**
   - One class/interface per file
   - Group related functionality together
   - Use barrel exports (`index.ts`) for modules

### Code Style

1. **Formatting**
   - Use 2 spaces for indentation
   - Use single quotes for strings
   - Always use semicolons
   - Use trailing commas in multiline objects/arrays

2. **ESLint Configuration**
   ```bash
   # Run linter
   npm run lint
   
   # Fix linting issues
   npm run lint:fix
   ```

3. **Code Examples**

   **Good:**
   ```typescript
   interface User {
     id: number;
     email: string;
     createdAt: Date;
   }

   export class UserService {
     async createUser(userData: CreateUserRequest): Promise<User> {
       const hashedPassword = await bcrypt.hash(userData.password, 12);
       
       return this.userRepository.create({
         ...userData,
         password: hashedPassword,
       });
     }
   }
   ```

   **Bad:**
   ```typescript
   class userService {
     createUser(data: any) {
       const pwd = bcrypt.hashSync(data.password, 12)
       return this.repo.create(data)
     }
   }
   ```

### API Design Guidelines

1. **RESTful Endpoints**
   - Use appropriate HTTP methods (GET, POST, PUT, DELETE)
   - Use plural nouns for resource names
   - Use consistent URL patterns

2. **Request/Response Format**
   ```typescript
   // Good response format
   {
     "success": true,
     "data": { ... },
     "message": "User created successfully"
   }

   // Error response format
   {
     "success": false,
     "error": {
       "code": "VALIDATION_ERROR",
       "message": "Invalid input data",
       "details": [...]
     }
   }
   ```

3. **Input Validation**
   - Always validate input using Joi schemas
   - Sanitize user input
   - Provide clear error messages

### Database Guidelines

1. **Migration Best Practices**
   - Always create reversible migrations
   - Use descriptive migration names
   - Test migrations in both directions

2. **Query Optimization**
   - Use appropriate indexes
   - Avoid N+1 queries
   - Use connection pooling

3. **Security**
   - Use parameterized queries
   - Validate all inputs
   - Implement proper access controls

## Testing Guidelines

### Testing Strategy

1. **Unit Tests** - Test individual functions and methods
2. **Integration Tests** - Test API endpoints and database interactions
3. **Performance Tests** - Test application performance under load

### Test Structure

```typescript
describe('UserController', () => {
  describe('POST /api/users', () => {
    it('should create a new user with valid data', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      // Act
      const response = await request(app)
        .post('/api/users')
        .send(userData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.data.email).toBe(userData.email);
    });

    it('should return validation error for invalid email', async () => {
      // Test implementation
    });
  });
});
```

### Test Best Practices

1. **Test Organization**
   - Group related tests using `describe` blocks
   - Use descriptive test names
   - Follow AAA pattern (Arrange, Act, Assert)

2. **Test Data**
   - Use test helpers for creating test data
   - Clean up test data after each test
   - Use factories for complex objects

3. **Mocking**
   - Mock external dependencies
   - Use realistic mock data
   - Don't over-mock

4. **Coverage**
   - Aim for high test coverage (>90%)
   - Focus on critical business logic
   - Test error scenarios

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test src/tests/controllers/user.test.ts

# Run tests with coverage
npm run test:coverage

# Run performance tests
npm run test:performance
```

## Documentation Guidelines

### Code Documentation

1. **JSDoc Comments**
   ```typescript
   /**
    * Creates a new user account
    * @param userData - User registration data
    * @returns Promise resolving to created user
    * @throws {ValidationError} When input data is invalid
    * @throws {ConflictError} When email already exists
    */
   async createUser(userData: CreateUserRequest): Promise<User> {
     // Implementation
   }
   ```

2. **README Updates**
   - Update README.md when adding new features
   - Include setup instructions for new dependencies
   - Document environment variables

3. **API Documentation**
   - Update API.md with new endpoints
   - Include request/response examples
   - Document error responses

### Documentation Standards

1. **Clarity** - Write for developers who are new to the project
2. **Completeness** - Cover all important aspects
3. **Examples** - Provide practical examples
4. **Maintenance** - Keep documentation up to date

## Pull Request Process

### Before Submitting

1. **Self Review**
   - Review your own code changes
   - Ensure all tests pass
   - Check code style compliance
   - Update documentation

2. **Testing**
   ```bash
   # Run full test suite
   npm run test:all
   
   # Check linting
   npm run lint
   
   # Build project
   npm run build
   ```

### Pull Request Template

When creating a pull request, use this template:

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass locally
```

### Review Process

1. **Automated Checks**
   - All tests must pass
   - Code coverage must meet standards
   - Linting must pass

2. **Code Review**
   - At least one maintainer review required
   - Address all review comments
   - Maintain respectful communication

3. **Merge**
   - Use "Squash and merge" for feature branches
   - Use descriptive merge commit messages

## Issue Guidelines

### Reporting Bugs

Use the bug report template:

```markdown
**Bug Description**
Clear description of the bug

**Steps to Reproduce**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happened

**Environment**
- OS: [e.g., Ubuntu 20.04]
- Node.js: [e.g., 18.17.0]
- npm: [e.g., 9.6.7]

**Additional Context**
Any other relevant information
```

### Feature Requests

Use the feature request template:

```markdown
**Feature Description**
Clear description of the proposed feature

**Use Case**
Why is this feature needed?

**Proposed Solution**
How should this feature work?

**Alternatives**
Other approaches considered

**Additional Context**
Any other relevant information
```

### Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `priority:high` - High priority
- `priority:medium` - Medium priority
- `priority:low` - Low priority

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- `MAJOR.MINOR.PATCH`
- `MAJOR` - Breaking changes
- `MINOR` - New features (backward compatible)
- `PATCH` - Bug fixes (backward compatible)

### Release Steps

1. **Prepare Release**
   ```bash
   # Update version in package.json
   npm version patch|minor|major
   
   # Update CHANGELOG.md
   # Update documentation
   ```

2. **Create Release**
   ```bash
   # Push changes
   git push origin main --tags
   
   # Create GitHub release
   # Deploy to production
   ```

### Changelog

Maintain `CHANGELOG.md` with:
- Added features
- Changed functionality
- Deprecated features
- Removed features
- Fixed bugs
- Security updates

## Community

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General discussions and Q&A
- **Pull Requests** - Code reviews and discussions

### Getting Help

1. **Documentation** - Check existing documentation first
2. **Search Issues** - Look for existing issues/discussions
3. **Create Issue** - If you can't find an answer, create a new issue
4. **Join Discussions** - Participate in GitHub Discussions

### Recognition

Contributors are recognized in:
- `CONTRIBUTORS.md` file
- Release notes
- GitHub contributors page

## Development Tools

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode-remote.remote-containers"
  ]
}
```

### Git Hooks

Set up pre-commit hooks:

```bash
# Install husky
npm install --save-dev husky

# Set up pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm test"
```

### Debugging

1. **VS Code Debugging**
   ```json
   {
     "type": "node",
     "request": "launch",
     "name": "Debug API",
     "program": "${workspaceFolder}/src/index.ts",
     "outFiles": ["${workspaceFolder}/dist/**/*.js"],
     "env": {
       "NODE_ENV": "development"
     }
   }
   ```

2. **Database Debugging**
   ```bash
   # Connect to database
   psql -h localhost -U your_user -d taskmanager_dev
   
   # View logs
   tail -f logs/app.log
   ```

## Tips for New Contributors

1. **Start Small** - Begin with documentation improvements or small bug fixes
2. **Ask Questions** - Don't hesitate to ask for clarification
3. **Read Code** - Familiarize yourself with the existing codebase
4. **Follow Patterns** - Maintain consistency with existing code
5. **Test Thoroughly** - Ensure your changes don't break existing functionality

## Thank You

Thank you for contributing to the AI Task Management Assistant backend! Your contributions help make this project better for everyone. We appreciate your time and effort in improving the project.

For any questions about contributing, please don't hesitate to reach out through GitHub issues or discussions.
