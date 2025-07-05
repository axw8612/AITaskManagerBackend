import request from 'supertest';
import { app } from '../../index';
import { TestHelpers, TestData } from '../utils/testHelpers';
import { db } from '../../database/connection';

describe('AI Controller', () => {
  let authToken: string;
  let testUser: any;
  let testProject: any;

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

  describe('GET /api/ai/task-suggestions', () => {
    it('should get task suggestions without project filter', async () => {
      const response = await request(app)
        .get('/api/ai/task-suggestions')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
    });

    it('should get task suggestions for specific project', async () => {
      const response = await request(app)
        .get(`/api/ai/task-suggestions?projectId=${testProject.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('suggestions');
      expect(response.body.data).toHaveProperty('context');
    });

    it('should get task suggestions with context', async () => {
      const response = await request(app)
        .get('/api/ai/task-suggestions?context=bug fix&limit=3')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data.suggestions.length).toBeLessThanOrEqual(3);
      expect(response.body.data.suggestions[0]).toHaveProperty('title');
      expect(response.body.data.suggestions[0]).toHaveProperty('description');
      expect(response.body.data.suggestions[0]).toHaveProperty('priority');
    });

    it('should deny access to project not owned by user', async () => {
      // Create another user and project
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.alternative);
      
      const otherUser = otherUserResponse.body.data.user;
      const otherProject = await TestHelpers.createTestProject(otherUser.id);

      const response = await request(app)
        .get(`/api/ai/task-suggestions?projectId=${otherProject.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectForbiddenError(response);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/ai/task-suggestions');

      TestHelpers.expectAuthError(response);
    });
  });

  describe('POST /api/ai/estimate-time', () => {
    it('should estimate time for a task', async () => {
      const taskData = {
        title: 'Implement user authentication',
        description: 'Create JWT-based authentication system with login and registration',
        priority: 'high',
        taskType: 'feature'
      };

      const response = await request(app)
        .post('/api/ai/estimate-time')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('estimation');
      expect(response.body.data.estimation).toHaveProperty('hours');
      expect(response.body.data.estimation).toHaveProperty('minutes');
      expect(response.body.data.estimation).toHaveProperty('confidence');
      expect(response.body.data).toHaveProperty('suggestionId');
    });

    it('should require task title', async () => {
      const response = await request(app)
        .post('/api/ai/estimate-time')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Task without title',
          priority: 'medium'
        });

      TestHelpers.expectValidationError(response, 'title');
    });

    it('should handle different task types', async () => {
      const taskData = {
        title: 'Fix critical bug',
        description: 'Fix memory leak in production',
        priority: 'urgent',
        taskType: 'bug'
      };

      const response = await request(app)
        .post('/api/ai/estimate-time')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data.estimation.factors.taskType).toBe('bug');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/ai/estimate-time')
        .send({
          title: 'Test task',
          description: 'Test description'
        });

      TestHelpers.expectAuthError(response);
    });
  });

  describe('POST /api/ai/suggest-priority', () => {
    it('should suggest priority for a task', async () => {
      const taskData = {
        title: 'Critical production issue',
        description: 'Server is down and users cannot access the application',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        projectId: testProject.id
      };

      const response = await request(app)
        .post('/api/ai/suggest-priority')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('priority');
      expect(response.body.data).toHaveProperty('confidence');
      expect(response.body.data).toHaveProperty('reasoning');
      expect(response.body.data).toHaveProperty('suggestionId');
      expect(['low', 'medium', 'high', 'urgent']).toContain(response.body.data.priority);
    });

    it('should suggest high priority for urgent keywords', async () => {
      const taskData = {
        title: 'Critical emergency bug fix',
        description: 'System is broken and needs immediate attention'
      };

      const response = await request(app)
        .post('/api/ai/suggest-priority')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(['high', 'urgent']).toContain(response.body.data.priority);
    });

    it('should require task title', async () => {
      const response = await request(app)
        .post('/api/ai/suggest-priority')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Task without title'
        });

      TestHelpers.expectValidationError(response, 'title');
    });

    it('should deny access to project not owned by user', async () => {
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.alternative);
      
      const otherUser = otherUserResponse.body.data.user;
      const otherProject = await TestHelpers.createTestProject(otherUser.id);

      const response = await request(app)
        .post('/api/ai/suggest-priority')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test task',
          description: 'Test description',
          projectId: otherProject.id
        });

      TestHelpers.expectForbiddenError(response);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/ai/suggest-priority')
        .send({
          title: 'Test task',
          description: 'Test description'
        });

      TestHelpers.expectAuthError(response);
    });
  });

  describe('POST /api/ai/suggest-assignee', () => {
    beforeEach(async () => {
      // Add another member to the project
      const memberUser = await TestHelpers.createTestUser({
        username: 'projectmember',
        email: 'member@example.com'
      });
      await TestHelpers.addProjectMember(testProject.id, memberUser.id, 'member');
    });

    it('should suggest assignees for a task', async () => {
      const taskData = {
        title: 'Frontend development task',
        description: 'Implement React components for user dashboard',
        projectId: testProject.id,
        skillsRequired: ['React', 'JavaScript', 'CSS'],
        workload: 'normal'
      };

      const response = await request(app)
        .post('/api/ai/suggest-assignee')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('suggestions');
      expect(response.body.data).toHaveProperty('projectMemberCount');
      expect(response.body.data).toHaveProperty('suggestionId');
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
      
      if (response.body.data.suggestions.length > 0) {
        const suggestion = response.body.data.suggestions[0];
        expect(suggestion).toHaveProperty('user');
        expect(suggestion).toHaveProperty('score');
        expect(suggestion).toHaveProperty('confidence');
        expect(suggestion).toHaveProperty('reasons');
      }
    });

    it('should require title and project ID', async () => {
      const response = await request(app)
        .post('/api/ai/suggest-assignee')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Task without title or project'
        });

      TestHelpers.expectValidationError(response, 'title');
    });

    it('should deny access to project not owned by user', async () => {
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.alternative);
      
      const otherUser = otherUserResponse.body.data.user;
      const otherProject = await TestHelpers.createTestProject(otherUser.id);

      const response = await request(app)
        .post('/api/ai/suggest-assignee')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test task',
          description: 'Test description',
          projectId: otherProject.id
        });

      TestHelpers.expectForbiddenError(response);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/ai/suggest-assignee')
        .send({
          title: 'Test task',
          projectId: testProject.id
        });

      TestHelpers.expectAuthError(response);
    });
  });

  describe('POST /api/ai/breakdown-task', () => {
    it('should break down a task into subtasks', async () => {
      const taskData = {
        title: 'Build a complete user authentication system',
        description: 'Implement user registration, login, password reset, and email verification',
        complexity: 'high',
        projectId: testProject.id
      };

      const response = await request(app)
        .post('/api/ai/breakdown-task')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('subtasks');
      expect(response.body.data).toHaveProperty('totalEstimatedHours');
      expect(response.body.data).toHaveProperty('complexity');
      expect(response.body.data).toHaveProperty('confidence');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('suggestionId');
      
      expect(Array.isArray(response.body.data.subtasks)).toBe(true);
      expect(response.body.data.subtasks.length).toBeGreaterThan(0);
      
      if (response.body.data.subtasks.length > 0) {
        const subtask = response.body.data.subtasks[0];
        expect(subtask).toHaveProperty('title');
        expect(subtask).toHaveProperty('estimatedHours');
        expect(subtask).toHaveProperty('priority');
      }
    });

    it('should handle different complexity levels', async () => {
      const taskData = {
        title: 'Simple bug fix',
        description: 'Fix typo in user interface',
        complexity: 'low'
      };

      const response = await request(app)
        .post('/api/ai/breakdown-task')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData);

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data.complexity).toBe('low');
      expect(response.body.data.subtasks.length).toBeLessThanOrEqual(3);
    });

    it('should require task title', async () => {
      const response = await request(app)
        .post('/api/ai/breakdown-task')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Task without title',
          complexity: 'medium'
        });

      TestHelpers.expectValidationError(response, 'title');
    });

    it('should deny access to project not owned by user', async () => {
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.alternative);
      
      const otherUser = otherUserResponse.body.data.user;
      const otherProject = await TestHelpers.createTestProject(otherUser.id);

      const response = await request(app)
        .post('/api/ai/breakdown-task')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test task',
          description: 'Test description',
          projectId: otherProject.id
        });

      TestHelpers.expectForbiddenError(response);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/ai/breakdown-task')
        .send({
          title: 'Test task',
          description: 'Test description'
        });

      TestHelpers.expectAuthError(response);
    });
  });

  describe('AI Suggestions Storage', () => {
    it('should store task suggestions in database', async () => {
      await request(app)
        .get('/api/ai/task-suggestions?context=testing&limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      const suggestions = await db('ai_suggestions')
        .where('user_id', testUser.id)
        .where('suggestion_type', 'task');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('content');
      expect(suggestions[0]).toHaveProperty('context');
    });

    it('should store time estimation in database', async () => {
      await request(app)
        .post('/api/ai/estimate-time')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test task',
          description: 'Test description'
        });

      const suggestions = await db('ai_suggestions')
        .where('user_id', testUser.id)
        .where('suggestion_type', 'time_estimation');

      expect(suggestions.length).toBe(1);
      expect(suggestions[0]).toHaveProperty('content');
    });
  });
});
