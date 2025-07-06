# AI Task Manager Backend - API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```http
Authorization: Bearer <jwt_token>
```

Tokens are obtained from the login endpoint and are valid for 7 days by default.

## Standard Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation details"
  }
}
```

## HTTP Status Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## Authentication Endpoints

### Register User
Register a new user account.

```http
POST /api/auth/register
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securePassword123",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "user",
      "is_active": true,
      "created_at": "2025-07-06T10:00:00Z"
    }
  }
}
```

**Validation Rules:**
- `username`: Required, 3-30 characters, alphanumeric + underscore
- `email`: Required, valid email format, unique
- `password`: Required, minimum 8 characters
- `first_name`: Required, 1-50 characters
- `last_name`: Required, 1-50 characters

---

### Login User
Authenticate user and get JWT token.

```http
POST /api/auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe"
    }
  }
}
```

---

### Logout User
Invalidate the current JWT token.

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Refresh Token
Get a new JWT token using the current token.

```http
POST /api/auth/refresh
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### Forgot Password
Request a password reset token.

```http
POST /api/auth/forgot-password
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

---

### Reset Password
Reset password using a valid reset token.

```http
POST /api/auth/reset-password
Content-Type: application/json
```

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "password": "newSecurePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

## User Endpoints

### Get User Profile
Get current user's profile information.

```http
GET /api/users/profile
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "user",
    "is_active": true,
    "created_at": "2025-07-06T10:00:00Z",
    "updated_at": "2025-07-06T10:00:00Z"
  }
}
```

---

### Update User Profile
Update current user's profile information.

```http
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Smith",
  "username": "johnsmith"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "johnsmith",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Smith",
    "role": "user",
    "is_active": true,
    "updated_at": "2025-07-06T10:30:00Z"
  }
}
```

---

### Search Users
Search for users by username or email.

```http
GET /api/users/search?query=john&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters:**
- `query`: Search term (required)
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 10, max: 50)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "johndoe",
        "email": "john@example.com",
        "first_name": "John",
        "last_name": "Doe"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

### Get User Statistics
Get current user's statistics.

```http
GET /api/users/stats
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalProjects": 5,
    "totalTasks": 23,
    "completedTasks": 18,
    "pendingTasks": 5,
    "tasksByPriority": {
      "low": 2,
      "medium": 8,
      "high": 10,
      "urgent": 3
    },
    "tasksByStatus": {
      "todo": 5,
      "in_progress": 3,
      "done": 15
    }
  }
}
```

---

## Project Endpoints

### List Projects
Get list of projects for the current user.

```http
GET /api/projects?status=active&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters:**
- `status`: Filter by status (active, archived, all)
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 10)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": 1,
        "name": "Website Redesign",
        "description": "Complete redesign of company website",
        "status": "active",
        "created_by": 1,
        "created_at": "2025-07-01T10:00:00Z",
        "updated_at": "2025-07-06T10:00:00Z",
        "member_count": 5,
        "task_count": 12,
        "role": "owner"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

### Create Project
Create a new project.

```http
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Mobile App Development",
  "description": "Develop a mobile app for task management",
  "status": "active"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Mobile App Development",
    "description": "Develop a mobile app for task management",
    "status": "active",
    "created_by": 1,
    "created_at": "2025-07-06T10:00:00Z",
    "updated_at": "2025-07-06T10:00:00Z"
  }
}
```

---

### Get Project Details
Get detailed information about a specific project.

```http
GET /api/projects/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Website Redesign",
    "description": "Complete redesign of company website",
    "status": "active",
    "created_by": 1,
    "created_at": "2025-07-01T10:00:00Z",
    "updated_at": "2025-07-06T10:00:00Z",
    "members": [
      {
        "id": 1,
        "username": "johndoe",
        "first_name": "John",
        "last_name": "Doe",
        "role": "owner",
        "joined_at": "2025-07-01T10:00:00Z"
      },
      {
        "id": 2,
        "username": "janedoe",
        "first_name": "Jane",
        "last_name": "Doe",
        "role": "member",
        "joined_at": "2025-07-02T10:00:00Z"
      }
    ],
    "tasks": [
      {
        "id": 1,
        "title": "Design homepage",
        "status": "in_progress",
        "priority": "high",
        "assigned_to": 2,
        "due_date": "2025-07-15T10:00:00Z"
      }
    ]
  }
}
```

---

### Add Project Member
Add a new member to a project.

```http
POST /api/projects/:id/members
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": 3,
  "role": "member"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Member added successfully",
    "member": {
      "user_id": 3,
      "project_id": 1,
      "role": "member",
      "joined_at": "2025-07-06T10:00:00Z"
    }
  }
}
```

---

## Task Endpoints

### List Tasks
Get list of tasks with filtering options.

```http
GET /api/tasks?projectId=1&status=in_progress&priority=high&assignedTo=2&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters:**
- `projectId`: Filter by project ID
- `status`: Filter by status (todo, in_progress, done)
- `priority`: Filter by priority (low, medium, high, urgent)
- `assignedTo`: Filter by assigned user ID
- `search`: Search in title and description
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 10)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": 1,
        "title": "Implement user authentication",
        "description": "Add JWT-based authentication system",
        "status": "in_progress",
        "priority": "high",
        "project_id": 1,
        "assigned_to": 2,
        "created_by": 1,
        "due_date": "2025-07-15T10:00:00Z",
        "created_at": "2025-07-06T10:00:00Z",
        "updated_at": "2025-07-06T10:30:00Z",
        "assignee": {
          "id": 2,
          "username": "janedoe",
          "first_name": "Jane",
          "last_name": "Doe"
        },
        "project": {
          "id": 1,
          "name": "Website Redesign"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

### Create Task
Create a new task.

```http
POST /api/tasks
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Design user interface",
  "description": "Create mockups and wireframes for the new interface",
  "projectId": 1,
  "priority": "medium",
  "status": "todo",
  "assignedTo": 2,
  "dueDate": "2025-07-20T10:00:00Z"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "title": "Design user interface",
    "description": "Create mockups and wireframes for the new interface",
    "status": "todo",
    "priority": "medium",
    "project_id": 1,
    "assigned_to": 2,
    "created_by": 1,
    "due_date": "2025-07-20T10:00:00Z",
    "created_at": "2025-07-06T10:00:00Z",
    "updated_at": "2025-07-06T10:00:00Z"
  }
}
```

---

### Update Task
Update an existing task.

```http
PUT /api/tasks/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "in_progress",
  "priority": "high",
  "assignedTo": 3
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Implement user authentication",
    "description": "Add JWT-based authentication system",
    "status": "in_progress",
    "priority": "high",
    "project_id": 1,
    "assigned_to": 3,
    "created_by": 1,
    "due_date": "2025-07-15T10:00:00Z",
    "created_at": "2025-07-06T10:00:00Z",
    "updated_at": "2025-07-06T11:00:00Z"
  }
}
```

---

### Add Task Attachment
Add a file attachment to a task.

```http
POST /api/tasks/:id/attachments
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "filename": "requirements.pdf",
  "originalName": "Project Requirements.pdf",
  "mimeType": "application/pdf",
  "size": 52428
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "task_id": 1,
    "filename": "requirements.pdf",
    "original_name": "Project Requirements.pdf",
    "mime_type": "application/pdf",
    "size": 52428,
    "uploaded_by": 1,
    "uploaded_at": "2025-07-06T10:00:00Z"
  }
}
```

---

## AI Endpoints

### Get Task Suggestions
Get AI-powered task suggestions.

```http
GET /api/ai/task-suggestions?projectId=1&context=authentication&limit=5
Authorization: Bearer <token>
```

**Query Parameters:**
- `projectId`: Project ID for context (optional)
- `context`: Context string for suggestions (optional)
- `limit`: Number of suggestions (default: 5, max: 10)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "id": 1,
        "title": "Setup JWT middleware",
        "description": "Implement JWT validation middleware for protected routes",
        "priority": "high",
        "estimatedHours": 4,
        "confidence": 0.8
      },
      {
        "id": 2,
        "title": "Create login API endpoint",
        "description": "Develop user login endpoint with email/password validation",
        "priority": "high",
        "estimatedHours": 3,
        "confidence": 0.9
      }
    ],
    "context": {
      "projectCount": 1,
      "existingTaskCount": 5
    }
  }
}
```

---

### Estimate Task Time
Get AI-powered time estimation for a task.

```http
POST /api/ai/estimate-time
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Implement user authentication system",
  "description": "Create complete authentication flow with JWT tokens, password hashing, and user registration",
  "priority": "high",
  "taskType": "feature"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "estimation": {
      "hours": 8,
      "minutes": 30,
      "totalHours": 8.5,
      "confidence": 0.7,
      "factors": {
        "complexity": "high",
        "priority": "high",
        "taskType": "feature",
        "historicalDataPoints": 15
      }
    },
    "suggestionId": 123
  }
}
```

---

### Suggest Task Priority
Get AI-powered priority suggestion for a task.

```http
POST /api/ai/suggest-priority
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Critical security vulnerability",
  "description": "Fix XSS vulnerability in user input fields - reported by security audit",
  "dueDate": "2025-07-08T10:00:00Z",
  "projectId": 1
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "priority": "urgent",
    "confidence": 0.9,
    "score": 95,
    "reasoning": [
      "High urgency indicators detected",
      "Security-related issue",
      "Due date approaching"
    ],
    "factors": {
      "keywordAnalysis": "urgent",
      "dueDateProximity": "considered",
      "projectContext": "available"
    },
    "suggestionId": 124
  }
}
```

---

### Suggest Task Assignee
Get AI-powered assignee recommendations for a task.

```http
POST /api/ai/suggest-assignee
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Frontend React development",
  "description": "Implement user dashboard with React components and responsive design",
  "projectId": 1,
  "skillsRequired": ["React", "JavaScript", "CSS", "UI/UX"],
  "workload": "normal"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "user": {
          "id": 2,
          "username": "janedoe",
          "first_name": "Jane",
          "last_name": "Doe",
          "email": "jane@example.com"
        },
        "score": 85,
        "confidence": 0.8,
        "reasons": [
          "Current workload: 3 active tasks",
          "Experience: 24 total tasks",
          "Role: member",
          "Skills: React, JavaScript, CSS, UI/UX"
        ],
        "workloadStatus": "light"
      }
    ],
    "projectMemberCount": 5,
    "suggestionId": 125
  }
}
```

---

### Break Down Task
Get AI-powered task breakdown into subtasks.

```http
POST /api/ai/breakdown-task
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Build complete user management system",
  "description": "Implement full CRUD operations for user management with role-based permissions, user profiles, and administrative features",
  "complexity": "high",
  "projectId": 1
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subtasks": [
      {
        "title": "Design user database schema",
        "estimatedHours": 2,
        "priority": "high"
      },
      {
        "title": "Implement user CRUD API endpoints",
        "estimatedHours": 6,
        "priority": "high"
      },
      {
        "title": "Create user profile management",
        "estimatedHours": 4,
        "priority": "medium"
      },
      {
        "title": "Add role-based permissions",
        "estimatedHours": 5,
        "priority": "high"
      },
      {
        "title": "Build admin dashboard",
        "estimatedHours": 8,
        "priority": "medium"
      },
      {
        "title": "Add comprehensive testing",
        "estimatedHours": 4,
        "priority": "medium"
      },
      {
        "title": "Create documentation",
        "estimatedHours": 2,
        "priority": "low"
      }
    ],
    "totalEstimatedHours": 31,
    "complexity": "high",
    "confidence": 0.7,
    "recommendations": [
      "Start with high-priority subtasks",
      "Consider breaking down large subtasks further",
      "Review estimates after beginning work",
      "Update progress regularly"
    ],
    "suggestionId": 126
  }
}
```

---

## Real-time Events (Socket.IO)

The application supports real-time updates through WebSocket connections.

### Connection
```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### Events

#### Task Events
- `task:created` - New task created
- `task:updated` - Task updated
- `task:deleted` - Task deleted
- `task:assigned` - Task assigned to user

#### Project Events
- `project:updated` - Project updated
- `project:member:added` - Member added to project
- `project:member:removed` - Member removed from project

#### Example Event Data
```javascript
socket.on('task:updated', (data) => {
  console.log('Task updated:', data);
  // {
  //   taskId: 123,
  //   projectId: 1,
  //   changes: ['status', 'assignee'],
  //   updatedBy: 2,
  //   timestamp: '2025-07-06T10:00:00Z'
  // }
});
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authentication endpoints**: 5 requests per minute
- **General API**: 100 requests per 15 minutes
- **AI endpoints**: 20 requests per minute

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1625572800
```

---

## Pagination

List endpoints support pagination with the following parameters:

- `page`: Page number (starts from 1)
- `limit`: Items per page (default: 10, max: 100)

Pagination response format:
```json
{
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## File Upload

File uploads are handled through multipart form data. Supported file types and limits:

- **Max file size**: 5MB
- **Supported types**: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, GIF
- **Upload directory**: `uploads/`

Example upload request:
```http
POST /api/tasks/:id/attachments
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: [binary data]
```

---

## Error Codes

Common error codes and their meanings:

- `VALIDATION_ERROR` - Input validation failed
- `AUTHENTICATION_REQUIRED` - No valid token provided
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `DUPLICATE_RESOURCE` - Resource already exists
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `SERVER_ERROR` - Internal server error

---

This API documentation covers all the main endpoints and features of the AI Task Management Assistant backend. For more detailed information about testing, deployment, and development, see the main [README.md](README.md) file.
