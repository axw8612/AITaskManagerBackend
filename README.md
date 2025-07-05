# AI Task Management Assistant Backend

A comprehensive backend API for an AI-powered task management system built with TypeScript, Express.js, PostgreSQL, and Redis.

## Features

- **User Authentication & Authorization**: JWT-based authentication with role-based access control
- **Task Management**: Complete CRUD operations for tasks with AI-powered suggestions
- **Project Management**: Multi-user project collaboration with role-based permissions
- **Real-time Updates**: WebSocket support for live notifications and updates
- **AI Integration**: OpenAI GPT-4 integration for intelligent task suggestions and automation
- **File Management**: Support for task attachments and file uploads
- **Advanced Search**: Full-text search and filtering capabilities
- **Analytics**: Task and project analytics with reporting
- **Security**: Rate limiting, input validation, and comprehensive security measures

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Knex.js ORM
- **Cache**: Redis for session management and caching
- **Authentication**: JWT with bcrypt password hashing
- **AI**: OpenAI GPT-4 API integration
- **Real-time**: Socket.IO for WebSocket communication
- **Testing**: Jest with TypeScript support
- **Validation**: Joi for request validation
- **Logging**: Winston for structured logging
- **Security**: Helmet, CORS, Rate limiting

## Prerequisites

- Node.js 18.x or higher
- PostgreSQL 14.x or higher
- Redis 6.x or higher
- OpenAI API key (for AI features)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-task-management-backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```env
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_task_manager
DB_USER=postgres
DB_PASSWORD=your_password_here

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_super_secret_jwt_key_here

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here
```

5. Set up the database:
```bash
# Create database
createdb ai_task_manager

# Run migrations
npm run migrate
```

## Development

Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000` with hot-reloading enabled.

## Building for Production

```bash
npm run build
npm start
```

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/verify-email` - Verify email address

### User Endpoints

- `GET /api/users/profile` - Get current user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/search` - Search users
- `GET /api/users/:id` - Get user by ID

### Task Endpoints

- `GET /api/tasks` - Get tasks (with filtering)
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/:id/attachments` - Add attachment to task
- `DELETE /api/tasks/:id/attachments/:attachmentId` - Remove attachment

### Project Endpoints

- `GET /api/projects` - Get projects
- `GET /api/projects/:id` - Get project by ID
- `POST /api/projects` - Create new project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/members` - Add project member
- `DELETE /api/projects/:id/members/:userId` - Remove project member
- `PUT /api/projects/:id/archive` - Archive project

### AI Endpoints

- `POST /api/ai/task-suggestions` - Get AI task suggestions
- `POST /api/ai/time-estimate` - Get AI time estimates
- `POST /api/ai/priority-suggestion` - Get AI priority suggestions
- `POST /api/ai/assignee-suggestion` - Get AI assignee suggestions
- `POST /api/ai/task-breakdown` - Get AI task breakdown

## Database Schema

The application uses PostgreSQL with the following main tables:

- `users` - User accounts and profiles
- `projects` - Project information
- `project_members` - Project membership and roles
- `tasks` - Task details and metadata
- `task_attachments` - File attachments for tasks
- `ai_suggestions` - AI-generated suggestions for tasks

## WebSocket Events

The application supports real-time communication through WebSocket:

- `task-updated` - Task status/details changed
- `user-typing` - User is typing in task comments
- `user-stopped-typing` - User stopped typing
- `project-updated` - Project details changed
- `notification` - New notification for user

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting to prevent abuse
- Input validation and sanitization
- CORS configuration
- Helmet for security headers
- SQL injection prevention
- XSS protection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions, please open an issue in the repository.
