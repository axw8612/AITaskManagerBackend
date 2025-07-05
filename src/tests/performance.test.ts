import request from 'supertest';
import { app } from '../index';
import { TestHelpers, TestData } from './utils/testHelpers';
import { db } from '../database/connection';

describe('Performance and Load Tests', () => {
  let authToken: string;
  let testUser: any;
  let testProject: any;

  beforeEach(async () => {
    await TestHelpers.cleanDatabase();
    
    // Create test user and project
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send(TestData.user.valid);

    authToken = userResponse.body.data.token;
    testUser = userResponse.body.data.user;

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

  describe('Response Time Tests', () => {
    it('should respond to authentication requests within acceptable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: TestData.user.valid.email,
          password: TestData.user.valid.password
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      TestHelpers.expectSuccessResponse(response, 200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should respond to project creation within acceptable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Performance Test Project',
          description: 'Project created for performance testing'
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      TestHelpers.expectSuccessResponse(response, 201);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });

    it('should respond to task creation within acceptable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Performance Test Task',
          description: 'Task created for performance testing',
          projectId: testProject.id
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      TestHelpers.expectSuccessResponse(response, 201);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });

  describe('Concurrent Request Tests', () => {
    it('should handle multiple concurrent user registrations', async () => {
      const concurrentRequests = 10;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/auth/register')
          .send({
            username: `concurrent_user_${i}`,
            email: `concurrent_${i}@example.com`,
            password: 'password123',
            first_name: 'Concurrent',
            last_name: `User${i}`
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      // All registrations should succeed
      responses.forEach(response => {
        TestHelpers.expectSuccessResponse(response, 201);
      });

      // Verify all users were created
      const userCount = await db('users').count('* as count');
      expect(Number(userCount[0].count)).toBe(concurrentRequests + 1); // +1 for the setup user
    }, 15000);

    it('should handle multiple concurrent task creations', async () => {
      const concurrentRequests = 20;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Concurrent Task ${i}`,
            description: `Task ${i} created concurrently`,
            projectId: testProject.id,
            priority: 'medium'
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      // All task creations should succeed
      responses.forEach(response => {
        TestHelpers.expectSuccessResponse(response, 201);
      });

      // Verify all tasks were created
      const taskCount = await db('tasks').count('* as count');
      expect(Number(taskCount[0].count)).toBe(concurrentRequests);
    }, 15000);

    it('should handle concurrent AI suggestion requests', async () => {
      const concurrentRequests = 10;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .get(`/api/ai/task-suggestions?context=concurrent_test_${i}&limit=3`)
          .set('Authorization', `Bearer ${authToken}`);
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      // All AI requests should succeed
      responses.forEach(response => {
        TestHelpers.expectSuccessResponse(response, 200);
        expect(response.body.data.suggestions.length).toBeGreaterThan(0);
      });
    }, 15000);
  });

  describe('Large Dataset Tests', () => {
    it('should handle projects with many tasks efficiently', async () => {
      const taskCount = 100;
      const tasks: any[] = [];

      // Create many tasks
      for (let i = 0; i < taskCount; i++) {
        const taskData = {
          title: `Task ${i}`,
          description: `Description for task ${i}`,
          project_id: testProject.id,
          created_by: testUser.id,
          priority: ['low', 'medium', 'high', 'urgent'][i % 4],
          status: ['todo', 'in_progress', 'done'][i % 3],
          created_at: new Date(),
          updated_at: new Date()
        };
        tasks.push(taskData);
      }

      await db('tasks').insert(tasks);

      // Test fetching all tasks
      const startTime = Date.now();
      const response = await request(app)
        .get(`/api/tasks?projectId=${testProject.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      const endTime = Date.now();

      TestHelpers.expectSuccessResponse(response, 200);
      expect(response.body.data.tasks.length).toBe(taskCount);
      expect(endTime - startTime).toBeLessThan(3000); // Should respond within 3 seconds
    }, 30000);

    it('should handle pagination efficiently with large datasets', async () => {
      const taskCount = 500;
      const tasks: any[] = [];

      // Create many tasks
      for (let i = 0; i < taskCount; i++) {
        const taskData = {
          title: `Paginated Task ${i}`,
          description: `Description for paginated task ${i}`,
          project_id: testProject.id,
          created_by: testUser.id,
          priority: 'medium',
          status: 'todo',
          created_at: new Date(Date.now() - i * 1000), // Different timestamps
          updated_at: new Date()
        };
        tasks.push(taskData);
      }

      await db('tasks').insert(tasks);

      // Test pagination
      const page1Response = await request(app)
        .get(`/api/tasks?projectId=${testProject.id}&page=1&limit=50`)
        .set('Authorization', `Bearer ${authToken}`);

      const page2Response = await request(app)
        .get(`/api/tasks?projectId=${testProject.id}&page=2&limit=50`)
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(page1Response, 200);
      TestHelpers.expectSuccessResponse(page2Response, 200);
      
      expect(page1Response.body.data.tasks.length).toBe(50);
      expect(page2Response.body.data.tasks.length).toBe(50);
      
      // Tasks should be different between pages
      const page1Ids = page1Response.body.data.tasks.map((t: any) => t.id);
      const page2Ids = page2Response.body.data.tasks.map((t: any) => t.id);
      const overlap = page1Ids.filter((id: number) => page2Ids.includes(id));
      expect(overlap.length).toBe(0);
    }, 30000);
  });

  describe('Database Query Performance', () => {
    it('should execute complex queries efficiently', async () => {
      // Create multiple users, projects, and tasks
      const users: any[] = [];
      for (let i = 0; i < 10; i++) {
        const user = await TestHelpers.createTestUser({
          username: `perf_user_${i}`,
          email: `perf_user_${i}@example.com`
        });
        users.push(user);
      }

      // Create projects and add members
      const projects: any[] = [];
      for (let i = 0; i < 5; i++) {
        const project = await TestHelpers.createTestProject(users[0].id, {
          name: `Performance Project ${i}`
        });
        projects.push(project);

        // Add multiple members to each project
        for (let j = 1; j < 5; j++) {
          await TestHelpers.addProjectMember(project.id, users[j].id);
        }
      }

      // Create tasks
      for (let i = 0; i < 50; i++) {
        await TestHelpers.createTestTask(projects[i % 5].id, users[i % 10].id, {
          title: `Performance Task ${i}`,
          assigned_to: users[(i + 1) % 10].id
        });
      }

      // Test complex query - user's statistics
      const startTime = Date.now();
      const response = await request(app)
        .get('/api/users/stats')
        .set('Authorization', `Bearer ${TestHelpers.generateAuthToken(users[0])}`);
      const endTime = Date.now();

      TestHelpers.expectSuccessResponse(response, 200);
      expect(endTime - startTime).toBeLessThan(2000); // Should respond within 2 seconds
    }, 60000);
  });

  describe('Memory and Resource Usage', () => {
    it('should handle AI suggestion generation without memory leaks', async () => {
      const iterations = 50;
      const responses: any[] = [];

      for (let i = 0; i < iterations; i++) {
        const response = await request(app)
          .post('/api/ai/estimate-time')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Memory Test Task ${i}`,
            description: `Description ${i} `.repeat(100), // Large description
            priority: 'medium',
            taskType: 'feature'
          });

        TestHelpers.expectSuccessResponse(response, 200);
        responses.push(response.body);
      }

      // All requests should have succeeded
      expect(responses.length).toBe(iterations);
      
      // Check that suggestions were stored
      const suggestionCount = await db('ai_suggestions')
        .where('user_id', testUser.id)
        .where('suggestion_type', 'time_estimation')
        .count('* as count');
      
      expect(Number(suggestionCount[0].count)).toBe(iterations);
    }, 60000);
  });

  describe('Error Handling Under Load', () => {
    it('should handle authentication failures gracefully under load', async () => {
      const concurrentRequests = 20;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      // All should fail consistently
      responses.forEach(response => {
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
      });
    }, 15000);

    it('should handle validation errors consistently under load', async () => {
      const concurrentRequests = 15;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            description: 'Project without name'
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      // All should fail with validation error
      responses.forEach(response => {
        TestHelpers.expectValidationError(response, 'name');
      });
    }, 15000);
  });
});
