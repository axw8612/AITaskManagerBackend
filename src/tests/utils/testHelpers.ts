import request from 'supertest';
import { app } from '../../index';
import { db } from '../../database/connection';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config/config';

export interface TestUser {
  id: string; // UUID string format
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  role: string;
  is_active: boolean;
}

export interface TestProject {
  id: string; // UUID string format
  name: string;
  description: string;
  status: string;
  owner_id: string; // UUID string format
}

export interface TestTask {
  id: string; // UUID string format
  title: string;
  description: string;
  status: string;
  priority: string;
  project_id: string; // UUID string format
  assignee_id?: string; // UUID string format, renamed from assigned_to
  creator_id: string; // UUID string format, renamed from created_by
}

export class TestHelpers {
  static async cleanDatabase(): Promise<void> {
    // Clean up in reverse order of dependencies
    await db('ai_suggestions').del();
    await db('task_attachments').del();
    await db('tasks').del();
    await db('project_members').del();
    await db('projects').del();
    await db('password_reset_tokens').del();
    await db('users').del();
  }

  static async createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    const defaultUser = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      first_name: 'Test',
      last_name: 'User',
      password_hash: await bcrypt.hash('password123', 10),
      role: 'user',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    const userData = { ...defaultUser, ...overrides };
    const [user] = await db('users').insert(userData).returning('*');
    return user;
  }

  static async createTestProject(createdBy: string, overrides: Partial<TestProject> = {}): Promise<TestProject> {
    const defaultProject = {
      name: `Test Project ${Date.now()}`,
      description: 'Test project description',
      status: 'active',
      owner_id: createdBy,
      created_at: new Date(),
      updated_at: new Date()
    };

    const projectData = { ...defaultProject, ...overrides };
    const [project] = await db('projects').insert(projectData).returning('*');

    // Add creator as project owner
    await db('project_members').insert({
      project_id: project.id,
      user_id: createdBy,
      role: 'owner',
      joined_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });

    return project;
  }

  static async addProjectMember(projectId: string, userId: string, role: string = 'member'): Promise<void> {
    await db('project_members').insert({
      project_id: projectId,
      user_id: userId,
      role,
      joined_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  static async createTestTask(projectId: string, createdBy: string, overrides: Partial<TestTask> = {}): Promise<TestTask> {
    const defaultTask = {
      title: `Test Task ${Date.now()}`,
      description: 'Test task description',
      status: 'todo',
      priority: 'medium',
      project_id: projectId,
      creator_id: createdBy, // Changed from created_by to creator_id
      created_at: new Date(),
      updated_at: new Date()
    };

    const taskData = { ...defaultTask, ...overrides };
    const [task] = await db('tasks').insert(taskData).returning('*');
    return task;
  }

  static async createTask(createdBy: string, projectId: string, overrides: Partial<TestTask> = {}): Promise<TestTask> {
    return this.createTestTask(projectId, createdBy, overrides);
  }

  static generateAuthToken(user: TestUser): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );
  }

  static authenticatedRequest(method: 'get' | 'post' | 'put' | 'delete', url: string, user: TestUser) {
    const token = this.generateAuthToken(user);
    return request(app)[method](url).set('Authorization', `Bearer ${token}`);
  }

  static async createPasswordResetToken(userId: string, token: string): Promise<void> {
    await db('password_reset_tokens').insert({
      user_id: userId,
      token,
      email: 'test@example.com',
      expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      used: false,
      created_at: new Date()
    });
  }

  static async createTaskAttachment(taskId: number, uploadedBy: number): Promise<any> {
    const [attachment] = await db('task_attachments').insert({
      task_id: taskId,
      file_name: 'test-file.pdf',
      file_url: 'https://example.com/test-file.pdf',
      file_size: 1024,
      mime_type: 'application/pdf',
      uploaded_by: uploadedBy,
      uploaded_at: new Date()
    }).returning('*');
    return attachment;
  }

  static expectValidationError(response: any, field?: string): void {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    if (field) {
      expect(response.body.error.toLowerCase()).toContain(field.toLowerCase());
    }
  }

  static expectAuthenticationError(response: any): void {
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  }

  static expectAuthError(response: any): void {
    this.expectAuthenticationError(response);
  }

  static expectAuthorizationError(response: any): void {
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error');
  }

  static expectForbiddenError(response: any): void {
    this.expectAuthorizationError(response);
  }

  static expectNotFoundError(response: any): void {
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
  }

  static expectSuccessResponse(response: any, expectedStatus: number = 200): void {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
  }
}

// Test data generators
export const TestData = {
  user: {
    valid: {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      first_name: 'Test',
      last_name: 'User'
    },
    alternative: {
      username: 'altuser',
      email: 'alt@example.com',
      password: 'password123',
      first_name: 'Alt',
      last_name: 'User'
    },
    invalid: {
      missingEmail: {
        username: 'testuser',
        password: 'password123',
        first_name: 'Test',
        last_name: 'User'
      },
      invalidEmail: {
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123',
        first_name: 'Test',
        last_name: 'User'
      },
      shortPassword: {
        username: 'testuser',
        email: 'test@example.com',
        password: '123',
        first_name: 'Test',
        last_name: 'User'
      }
    }
  },
  project: {
    valid: {
      name: 'Test Project',
      description: 'A test project for testing purposes',
      status: 'active'
    },
    invalid: {
      missingName: {
        description: 'A test project without a name',
        status: 'active'
      }
    }
  },
  task: {
    valid: {
      title: 'Test Task',
      description: 'A test task for testing purposes',
      priority: 'medium',
      status: 'todo'
    },
    invalid: {
      missingTitle: {
        description: 'A test task without a title',
        priority: 'medium',
        status: 'todo'
      }
    }
  }
};
