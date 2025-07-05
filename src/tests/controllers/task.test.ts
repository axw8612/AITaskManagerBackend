import request from 'supertest';
import { app } from '../../index';
import { TestHelpers, TestData } from '../utils/testHelpers';
import { db } from '../../database/connection';

describe('Task Controller', () => {
  let authToken: string;
  let testUser: any;
  let testProject: any;
  let testTask: any;

  beforeEach(async () => {
    await TestHelpers.cleanDatabase();
    
    // Create test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send(TestData.user.valid);
    
    authToken = userResponse.body.data.token;
    testUser = userResponse.body.data.user;
    
    // Create test project
    const projectResponse = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send(TestData.project.valid);
    
    testProject = projectResponse.body.data;
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase();
    await db.destroy();
  });

  describe('GET /api/tasks', () => {
    it('should get tasks for user', async () => {
      // Create a task first
      await TestHelpers.createTask(testUser.id, testProject.id);

      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data.tasks).toBeDefined();
      expect(Array.isArray(response.body.data.tasks)).toBe(true);
    });

    it('should filter tasks by project', async () => {
      // Create task in project
      await TestHelpers.createTask(testUser.id, testProject.id);

      const response = await request(app)
        .get(`/api/tasks?projectId=${testProject.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data.tasks).toBeDefined();
    });

    it('should filter tasks by status', async () => {
      await TestHelpers.createTask(testUser.id, testProject.id, { status: 'in_progress' });

      const response = await request(app)
        .get('/api/tasks?status=in_progress')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data.tasks).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/tasks');

      TestHelpers.expectAuthError(response);
    });
  });

  describe('GET /api/tasks/:id', () => {
    beforeEach(async () => {
      testTask = await TestHelpers.createTask(testUser.id, testProject.id);
    });

    it('should get task by id', async () => {
      const response = await request(app)
        .get(`/api/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data.id).toBe(testTask.id);
      expect(response.body.data.title).toBe(testTask.title);
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .get('/api/tasks/999999')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectNotFoundError(response);
    });

    it('should deny access to task from different project', async () => {
      // Create another user and project
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.alternative);
      
      const otherToken = otherUserResponse.body.data.token;

      const response = await request(app)
        .get(`/api/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      TestHelpers.expectForbiddenError(response);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/tasks/${testTask.id}`);

      TestHelpers.expectAuthError(response);
    });
  });

  describe('POST /api/tasks', () => {
    it('should create task successfully', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        projectId: testProject.id,
        priority: 'high',
        status: 'todo'
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      TestHelpers.expectSuccessResponse(response, 201);
      expect(response.body.data.title).toBe(taskData.title);
      expect(response.body.data.description).toBe(taskData.description);
      expect(response.body.data.priority).toBe(taskData.priority);
      expect(response.body.data.status).toBe(taskData.status);
    });

    it('should require title', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Test Description',
          projectId: testProject.id
        });

      TestHelpers.expectValidationError(response, 'title');
    });

    it('should require valid project ID', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Task',
          projectId: 999999
        });

      TestHelpers.expectForbiddenError(response);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({
          title: 'Test Task',
          projectId: testProject.id
        });

      TestHelpers.expectAuthError(response);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    beforeEach(async () => {
      testTask = await TestHelpers.createTask(testUser.id, testProject.id);
    });

    it('should update task successfully', async () => {
      const updateData = {
        title: 'Updated Task',
        description: 'Updated Description',
        priority: 'urgent',
        status: 'in_progress'
      };

      const response = await request(app)
        .put(`/api/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.priority).toBe(updateData.priority);
      expect(response.body.data.status).toBe(updateData.status);
    });

    it('should deny access to task from different project', async () => {
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.alternative);
      
      const otherToken = otherUserResponse.body.data.token;

      const response = await request(app)
        .put(`/api/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          title: 'Updated Task'
        });

      TestHelpers.expectForbiddenError(response);
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .put('/api/tasks/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Task'
        });

      TestHelpers.expectNotFoundError(response);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/tasks/${testTask.id}`)
        .send({
          title: 'Updated Task'
        });

      TestHelpers.expectAuthError(response);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    beforeEach(async () => {
      testTask = await TestHelpers.createTask(testUser.id, testProject.id);
    });

    it('should delete task successfully', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.message).toContain('deleted');
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .delete('/api/tasks/999999')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectNotFoundError(response);
    });

    it('should deny access to task from different project', async () => {
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.alternative);
      
      const otherToken = otherUserResponse.body.data.token;

      const response = await request(app)
        .delete(`/api/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      TestHelpers.expectForbiddenError(response);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${testTask.id}`);

      TestHelpers.expectAuthError(response);
    });
  });

  describe('POST /api/tasks/:id/attachments', () => {
    beforeEach(async () => {
      testTask = await TestHelpers.createTask(testUser.id, testProject.id);
    });

    it('should add attachment to task', async () => {
      const attachmentData = {
        filename: 'test-document.pdf',
        originalName: 'Test Document.pdf',
        mimeType: 'application/pdf',
        size: 12345
      };

      const response = await request(app)
        .post(`/api/tasks/${testTask.id}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(attachmentData);

      TestHelpers.expectSuccessResponse(response, 201);
      expect(response.body.data.filename).toBe(attachmentData.filename);
      expect(response.body.data.original_name).toBe(attachmentData.originalName);
      expect(response.body.data.mime_type).toBe(attachmentData.mimeType);
    });

    it('should require filename', async () => {
      const response = await request(app)
        .post(`/api/tasks/${testTask.id}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          originalName: 'Test Document.pdf'
        });

      TestHelpers.expectValidationError(response, 'filename');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/tasks/${testTask.id}/attachments`)
        .send({
          filename: 'test.pdf'
        });

      TestHelpers.expectAuthError(response);
    });
  });

  describe('DELETE /api/tasks/:id/attachments/:attachmentId', () => {
    let testAttachment: any;

    beforeEach(async () => {
      testTask = await TestHelpers.createTask(testUser.id, testProject.id);
      
      // Create attachment
      const attachmentData = {
        task_id: testTask.id,
        filename: 'test-document.pdf',
        original_name: 'Test Document.pdf',
        mime_type: 'application/pdf',
        size: 12345,
        uploaded_by: testUser.id
      };

      const [attachment] = await db('task_attachments')
        .insert(attachmentData)
        .returning('*');
      
      testAttachment = attachment;
    });

    it('should remove attachment from task', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${testTask.id}/attachments/${testAttachment.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.message).toContain('removed');
    });

    it('should return 404 for non-existent attachment', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${testTask.id}/attachments/999999`)
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectNotFoundError(response);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${testTask.id}/attachments/${testAttachment.id}`);

      TestHelpers.expectAuthError(response);
    });
  });
});
