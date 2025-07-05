<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# AI Task Management Assistant Backend - Copilot Instructions

This is an AI-powered task management backend API built with TypeScript, Express.js, PostgreSQL, and Redis.

## Project Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Knex.js ORM
- **Cache**: Redis for session management and caching
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **AI Integration**: OpenAI GPT-4 for intelligent task suggestions and automation
- **Real-time**: Socket.IO for live updates
- **Testing**: Jest with TypeScript support
- **Validation**: Joi for request validation
- **Logging**: Winston for structured logging

## Code Style Guidelines
- Use TypeScript with strict mode enabled
- Follow RESTful API conventions
- Implement proper error handling with custom error classes
- Use async/await for asynchronous operations
- Implement proper input validation and sanitization
- Follow the controller-service-repository pattern
- Use dependency injection where appropriate
- Write comprehensive unit and integration tests

## Key Features to Implement
- User registration and authentication
- Task CRUD operations with AI-powered suggestions
- Project management and collaboration
- Real-time notifications and updates
- File attachments and media support
- Advanced search and filtering
- Task automation and AI recommendations
- Analytics and reporting
- Team collaboration features

## Security Best Practices
- Implement rate limiting
- Use CORS properly
- Validate all inputs
- Sanitize user data
- Use parameterized queries
- Implement proper session management
- Use HTTPS in production
- Follow OWASP security guidelines

## Performance Considerations
- Implement database indexing
- Use Redis for caching frequently accessed data
- Optimize database queries
- Implement pagination for large datasets
- Use connection pooling
- Monitor and log performance metrics
