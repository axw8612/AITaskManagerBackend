import request from 'supertest';
import { app } from '../../index';
import { TestHelpers, TestData } from '../utils/testHelpers';
import { db } from '../../database/connection';

describe('User Controller', () => {
  let testUser: any;
  let otherUser: any;

  beforeEach(async () => {
    await TestHelpers.cleanDatabase();
    testUser = await TestHelpers.createTestUser({
      username: 'testuser1',
      email: 'test1@example.com',
      first_name: 'Test',
      last_name: 'User'
    });
    otherUser = await TestHelpers.createTestUser({
      username: 'testuser2',
      email: 'test2@example.com',
      first_name: 'Other',
      last_name: 'User'
    });
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase();
    await db.destroy();
  });

  describe('GET /api/users/profile', () => {
    it('should get user profile successfully', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/users/profile', testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.user).toHaveProperty('id', testUser.id);
      expect(response.body.data.user).toHaveProperty('username', testUser.username);
      expect(response.body.data.user).toHaveProperty('email', testUser.email);
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).get('/api/users/profile');
      TestHelpers.expectAuthenticationError(response);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token');
      
      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        first_name: 'Updated',
        last_name: 'Name',
        bio: 'Updated bio'
      };

      const response = await TestHelpers.authenticatedRequest('put', '/api/users/profile', testUser)
        .send(updateData);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.user.first_name).toBe(updateData.first_name);
      expect(response.body.data.user.last_name).toBe(updateData.last_name);
      expect(response.body.data.user.bio).toBe(updateData.bio);

      // Verify in database
      const updatedUser = await db('users').where('id', testUser.id).first();
      expect(updatedUser.first_name).toBe(updateData.first_name);
      expect(updatedUser.last_name).toBe(updateData.last_name);
      expect(updatedUser.bio).toBe(updateData.bio);
    });

    it('should update username if unique', async () => {
      const updateData = { username: 'newusername' };

      const response = await TestHelpers.authenticatedRequest('put', '/api/users/profile', testUser)
        .send(updateData);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.user.username).toBe(updateData.username);
    });

    it('should reject username update if already taken', async () => {
      const updateData = { username: otherUser.username };

      const response = await TestHelpers.authenticatedRequest('put', '/api/users/profile', testUser)
        .send(updateData);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('username');
    });

    it('should reject email update if already taken', async () => {
      const updateData = { email: otherUser.email };

      const response = await TestHelpers.authenticatedRequest('put', '/api/users/profile', testUser)
        .send(updateData);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('email');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .send({ first_name: 'Updated' });
      
      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('GET /api/users/search', () => {
    beforeEach(async () => {
      // Create additional users for search testing
      await TestHelpers.createTestUser({
        username: 'searchuser1',
        email: 'search1@example.com',
        first_name: 'Search',
        last_name: 'User1'
      });
      await TestHelpers.createTestUser({
        username: 'searchuser2',
        email: 'search2@example.com',
        first_name: 'Search',
        last_name: 'User2'
      });
    });

    it('should search users by username', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/users/search?q=searchuser', testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.users).toHaveLength(2);
      expect(response.body.data.users[0].username).toContain('searchuser');
    });

    it('should search users by first name', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/users/search?q=Search', testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.users.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty results for non-existent users', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/users/search?q=nonexistent', testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.users).toHaveLength(0);
    });

    it('should limit search results', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/users/search?q=user&limit=1', testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.users.length).toBeLessThanOrEqual(1);
    });

    it('should reject search without query parameter', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/users/search', testUser);

      TestHelpers.expectValidationError(response, 'query');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).get('/api/users/search?q=test');
      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should get user by ID successfully', async () => {
      const response = await TestHelpers.authenticatedRequest('get', `/api/users/${otherUser.id}`, testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.user).toHaveProperty('id', otherUser.id);
      expect(response.body.data.user).toHaveProperty('username', otherUser.username);
      expect(response.body.data.user).not.toHaveProperty('password_hash');
      expect(response.body.data.user).not.toHaveProperty('email'); // Should not expose other users' emails
    });

    it('should reject request for non-existent user', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/users/99999', testUser);
      TestHelpers.expectNotFoundError(response);
    });

    it('should reject request for inactive user', async () => {
      await db('users').where('id', otherUser.id).update({ is_active: false });
      
      const response = await TestHelpers.authenticatedRequest('get', `/api/users/${otherUser.id}`, testUser);
      TestHelpers.expectNotFoundError(response);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).get(`/api/users/${otherUser.id}`);
      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('GET /api/users/:id/projects', () => {
    let project: any;

    beforeEach(async () => {
      project = await TestHelpers.createTestProject(testUser.id);
      await TestHelpers.addProjectMember(project.id, otherUser.id, 'member');
    });

    it('should get user projects successfully', async () => {
      const response = await TestHelpers.authenticatedRequest('get', `/api/users/${testUser.id}/projects`, testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.projects).toHaveLength(1);
      expect(response.body.data.projects[0]).toHaveProperty('id', project.id);
      expect(response.body.data.projects[0]).toHaveProperty('name', project.name);
    });

    it('should return empty array for user with no projects', async () => {
      const newUser = await TestHelpers.createTestUser();
      const response = await TestHelpers.authenticatedRequest('get', `/api/users/${newUser.id}/projects`, testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.projects).toHaveLength(0);
    });

    it('should reject request for non-existent user', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/users/99999/projects', testUser);
      TestHelpers.expectNotFoundError(response);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).get(`/api/users/${testUser.id}/projects`);
      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('GET /api/users/:id/tasks', () => {
    let project: any;
    let task: any;

    beforeEach(async () => {
      project = await TestHelpers.createTestProject(testUser.id);
      task = await TestHelpers.createTestTask(project.id, testUser.id, {
        assigned_to: testUser.id
      });
    });

    it('should get user tasks successfully', async () => {
      const response = await TestHelpers.authenticatedRequest('get', `/api/users/${testUser.id}/tasks`, testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0]).toHaveProperty('id', task.id);
      expect(response.body.data.tasks[0]).toHaveProperty('title', task.title);
    });

    it('should filter tasks by status', async () => {
      await TestHelpers.createTestTask(project.id, testUser.id, {
        assigned_to: testUser.id,
        status: 'in_progress'
      });

      const response = await TestHelpers.authenticatedRequest('get', `/api/users/${testUser.id}/tasks?status=todo`, testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.tasks[0].status).toBe('todo');
    });

    it('should return empty array for user with no tasks', async () => {
      const newUser = await TestHelpers.createTestUser();
      const response = await TestHelpers.authenticatedRequest('get', `/api/users/${newUser.id}/tasks`, testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.tasks).toHaveLength(0);
    });

    it('should reject request for non-existent user', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/users/99999/tasks', testUser);
      TestHelpers.expectNotFoundError(response);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).get(`/api/users/${testUser.id}/tasks`);
      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('GET /api/users/stats', () => {
    let project: any;

    beforeEach(async () => {
      project = await TestHelpers.createTestProject(testUser.id);
      await TestHelpers.createTestTask(project.id, testUser.id, {
        assigned_to: testUser.id,
        status: 'todo'
      });
      await TestHelpers.createTestTask(project.id, testUser.id, {
        assigned_to: testUser.id,
        status: 'done'
      });
    });

    it('should get user statistics successfully', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/users/stats', testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.stats).toHaveProperty('totalProjects', 1);
      expect(response.body.data.stats).toHaveProperty('totalTasks', 2);
      expect(response.body.data.stats).toHaveProperty('completedTasks', 1);
      expect(response.body.data.stats).toHaveProperty('activeTasks', 1);
      expect(response.body.data.stats).toHaveProperty('completionRate');
    });

    it('should handle user with no data', async () => {
      const newUser = await TestHelpers.createTestUser();
      const response = await TestHelpers.authenticatedRequest('get', '/api/users/stats', newUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.stats).toHaveProperty('totalProjects', 0);
      expect(response.body.data.stats).toHaveProperty('totalTasks', 0);
      expect(response.body.data.stats).toHaveProperty('completedTasks', 0);
      expect(response.body.data.stats).toHaveProperty('activeTasks', 0);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).get('/api/users/stats');
      TestHelpers.expectAuthenticationError(response);
    });
  });
});
