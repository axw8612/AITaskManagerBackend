import request from 'supertest';
import { app } from '../index';
import { TestHelpers, TestData } from './utils/testHelpers';
import { db } from '../database/connection';

describe('Integration Tests - Full Application Flow', () => {
  let authToken: string;
  let testUser: any;
  let testProject: any;
  let testTask: any;

  beforeEach(async () => {
    await TestHelpers.cleanDatabase();
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase();
    await db.destroy();
  });

  describe('Complete User Journey', () => {
    it('should complete full user journey: register -> create project -> create task -> AI suggestions', async () => {
      // 1. User Registration
      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.valid);

      TestHelpers.expectSuccessResponse(registrationResponse, 201);
      authToken = registrationResponse.body.data.token;
      testUser = registrationResponse.body.data.user;

      // 2. User Login (verify token works)
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: TestData.user.valid.email,
          password: TestData.user.valid.password
        });

      TestHelpers.expectSuccessResponse(loginResponse, 200);

      // 3. Get User Profile
      const profileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(profileResponse, 200);
      expect(profileResponse.body.data.email).toBe(TestData.user.valid.email);

      // 4. Create Project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.project.valid);

      TestHelpers.expectSuccessResponse(projectResponse, 201);
      testProject = projectResponse.body.data;

      // 5. Get Projects
      const projectsResponse = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(projectsResponse, 200);
      expect(projectsResponse.body.data.projects.length).toBe(1);

      // 6. Create Task
      const taskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Implement user authentication',
          description: 'Add JWT-based authentication system',
          projectId: testProject.id,
          priority: 'high'
        });

      TestHelpers.expectSuccessResponse(taskResponse, 201);
      testTask = taskResponse.body.data;

      // 7. Get Tasks
      const tasksResponse = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(tasksResponse, 200);
      expect(tasksResponse.body.data.tasks.length).toBe(1);

      // 8. Update Task
      const updateTaskResponse = await request(app)
        .put(`/api/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'in_progress',
          priority: 'urgent'
        });

      TestHelpers.expectSuccessResponse(updateTaskResponse, 200);
      expect(updateTaskResponse.body.data.status).toBe('in_progress');

      // 9. Get AI Task Suggestions
      const suggestionsResponse = await request(app)
        .get(`/api/ai/task-suggestions?projectId=${testProject.id}&context=authentication`)
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(suggestionsResponse, 200);
      expect(suggestionsResponse.body.data.suggestions.length).toBeGreaterThan(0);

      // 10. Get Time Estimation
      const timeEstimationResponse = await request(app)
        .post('/api/ai/estimate-time')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Add email verification',
          description: 'Implement email verification for new user registrations',
          priority: 'medium',
          taskType: 'feature'
        });

      TestHelpers.expectSuccessResponse(timeEstimationResponse, 200);
      expect(timeEstimationResponse.body.data.estimation).toHaveProperty('hours');

      // 11. Get Priority Suggestion
      const priorityResponse = await request(app)
        .post('/api/ai/suggest-priority')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Critical security vulnerability',
          description: 'Fix XSS vulnerability in user input fields',
          projectId: testProject.id
        });

      TestHelpers.expectSuccessResponse(priorityResponse, 200);
      expect(['high', 'urgent']).toContain(priorityResponse.body.data.priority);

      // 12. Get Task Breakdown
      const breakdownResponse = await request(app)
        .post('/api/ai/breakdown-task')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Complete user management system',
          description: 'Build full CRUD for user management with roles and permissions',
          complexity: 'high',
          projectId: testProject.id
        });

      TestHelpers.expectSuccessResponse(breakdownResponse, 200);
      expect(breakdownResponse.body.data.subtasks.length).toBeGreaterThan(0);

      // 13. Add Task Attachment
      const attachmentResponse = await request(app)
        .post(`/api/tasks/${testTask.id}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          filename: 'requirements.pdf',
          originalName: 'Project Requirements.pdf',
          mimeType: 'application/pdf',
          size: 52428
        });

      TestHelpers.expectSuccessResponse(attachmentResponse, 201);

      // 14. Get User Statistics
      const statsResponse = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(statsResponse, 200);
      expect(statsResponse.body.data).toHaveProperty('totalProjects');
      expect(statsResponse.body.data).toHaveProperty('totalTasks');

      // 15. Archive Project
      const archiveResponse = await request(app)
        .post(`/api/projects/${testProject.id}/archive`)
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(archiveResponse, 200);

      // 16. Verify archived project is not in active list
      const finalProjectsResponse = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(finalProjectsResponse, 200);
      const activeProjects = finalProjectsResponse.body.data.projects.filter(
        (p: any) => p.status === 'active'
      );
      expect(activeProjects.length).toBe(0);
    });
  });

  describe('Team Collaboration Flow', () => {
    it('should handle multi-user project collaboration', async () => {
      // Create first user (project owner)
      const ownerResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.valid);

      const ownerToken = ownerResponse.body.data.token;
      const owner = ownerResponse.body.data.user;

      // Create second user (team member)
      const memberResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.alternative);

      const memberToken = memberResponse.body.data.token;
      const member = memberResponse.body.data.user;

      // Owner creates project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(TestData.project.valid);

      testProject = projectResponse.body.data;

      // Owner adds member to project
      const addMemberResponse = await request(app)
        .post(`/api/projects/${testProject.id}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          userId: member.id,
          role: 'member'
        });

      TestHelpers.expectSuccessResponse(addMemberResponse, 200);

      // Member can now see the project
      const memberProjectsResponse = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${memberToken}`);

      TestHelpers.expectSuccessResponse(memberProjectsResponse, 200);
      expect(memberProjectsResponse.body.data.projects.length).toBe(1);

      // Owner creates task and assigns to member
      const taskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Design database schema',
          description: 'Create ERD and database migrations',
          projectId: testProject.id,
          assignedTo: member.id,
          priority: 'high'
        });

      testTask = taskResponse.body.data;

      // Member can see assigned task
      const memberTasksResponse = await request(app)
        .get(`/api/tasks?projectId=${testProject.id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      TestHelpers.expectSuccessResponse(memberTasksResponse, 200);
      expect(memberTasksResponse.body.data.tasks.length).toBe(1);
      expect(memberTasksResponse.body.data.tasks[0].assigned_to).toBe(member.id);

      // Member updates task status
      const updateResponse = await request(app)
        .put(`/api/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          status: 'in_progress'
        });

      TestHelpers.expectSuccessResponse(updateResponse, 200);

      // Owner can see updated task
      const ownerTaskResponse = await request(app)
        .get(`/api/tasks/${testTask.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      TestHelpers.expectSuccessResponse(ownerTaskResponse, 200);
      expect(ownerTaskResponse.body.data.status).toBe('in_progress');

      // Get AI assignee suggestions for the project
      const assigneeResponse = await request(app)
        .post('/api/ai/suggest-assignee')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Frontend development task',
          description: 'Create React components',
          projectId: testProject.id,
          skillsRequired: ['React', 'JavaScript']
        });

      TestHelpers.expectSuccessResponse(assigneeResponse, 200);
      expect(assigneeResponse.body.data.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      // Create authenticated user for these tests
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.valid);

      authToken = userResponse.body.data.token;
      testUser = userResponse.body.data.user;
    });

    it('should handle invalid tokens gracefully', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid_token');

      TestHelpers.expectAuthError(response);
    });

    it('should handle missing resources gracefully', async () => {
      const response = await request(app)
        .get('/api/tasks/999999')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectNotFoundError(response);
    });

    it('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invalidField: 'invalid value'
        });

      TestHelpers.expectValidationError(response);
    });

    it('should prevent unauthorized access to resources', async () => {
      // Create another user and their project
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.alternative);

      const otherUser = otherUserResponse.body.data.user;
      const otherProject = await TestHelpers.createTestProject(otherUser.id);

      // Try to access other user's project
      const response = await request(app)
        .get(`/api/projects/${otherProject.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectForbiddenError(response);
    });

    it('should handle database constraints', async () => {
      // Try to register with duplicate email
      await request(app)
        .post('/api/auth/register')
        .send(TestData.user.valid);

      const duplicateResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.valid);

      expect(duplicateResponse.status).toBe(400);
    });
  });
});
