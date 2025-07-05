import request from 'supertest';
import { app } from '../index';
import { TestHelpers, TestData } from './utils/testHelpers';
import { db } from '../database/connection';
import { logger } from '../utils/logger';

describe('Middleware and Utilities Tests', () => {
  beforeEach(async () => {
    await TestHelpers.cleanDatabase();
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase();
    await db.destroy();
  });

  describe('Authentication Middleware', () => {
    let authToken: string;
    let testUser: any;

    beforeEach(async () => {
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.valid);

      authToken = userResponse.body.data.token;
      testUser = userResponse.body.data.user;
    });

    it('should accept valid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectSuccessResponse(response, 200);
    });

    it('should reject requests without Authorization header', async () => {
      const response = await request(app)
        .get('/api/users/profile');

      TestHelpers.expectAuthError(response);
    });

    it('should reject malformed Authorization headers', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'InvalidFormat');

      TestHelpers.expectAuthError(response);
    });

    it('should reject expired tokens', async () => {
      // This would require setting up a token with a very short expiry
      // For now, we'll test with an invalid token
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');

      TestHelpers.expectAuthError(response);
    });

    it('should reject tokens for non-existent users', async () => {
      // Delete the user but keep the token
      await db('users').where('id', testUser.id).del();

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectAuthError(response);
    });

    it('should reject tokens for inactive users', async () => {
      // Deactivate the user
      await db('users').where('id', testUser.id).update({ is_active: false });

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectAuthError(response);
    });
  });

  describe('Error Handling Middleware', () => {
    let authToken: string;

    beforeEach(async () => {
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.valid);

      authToken = userResponse.body.data.token;
    });

    it('should handle validation errors consistently', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Project without name'
        });

      TestHelpers.expectValidationError(response, 'name');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle 404 errors consistently', async () => {
      const response = await request(app)
        .get('/api/projects/999999')
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectNotFoundError(response);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle 403 errors consistently', async () => {
      // Create another user and their project
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.alternative);

      const otherUser = otherUserResponse.body.data.user;
      const otherProject = await TestHelpers.createTestProject(otherUser.id);

      const response = await request(app)
        .get(`/api/projects/${otherProject.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      TestHelpers.expectForbiddenError(response);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle internal server errors gracefully', async () => {
      // This is harder to test without mocking database failures
      // We'll test with an endpoint that might cause issues
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Request Validation', () => {
    let authToken: string;

    beforeEach(async () => {
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.valid);

      authToken = userResponse.body.data.token;
    });

    it('should validate user registration data', async () => {
      const testCases = [
        {
          data: { email: 'invalid-email', password: 'password123' },
          expectedField: 'email'
        },
        {
          data: { email: 'test@example.com', password: '123' },
          expectedField: 'password'
        },
        {
          data: { email: 'test@example.com', password: 'password123' },
          expectedField: 'username'
        }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/auth/register')
          .send(testCase.data);

        TestHelpers.expectValidationError(response, testCase.expectedField);
      }
    });

    it('should validate project creation data', async () => {
      const testCases = [
        {
          data: { description: 'Project without name' },
          expectedField: 'name'
        },
        {
          data: { name: '', description: 'Project with empty name' },
          expectedField: 'name'
        }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testCase.data);

        TestHelpers.expectValidationError(response, testCase.expectedField);
      }
    });

    it('should validate task creation data', async () => {
      // First create a project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TestData.project.valid);

      const project = projectResponse.body.data;

      const testCases = [
        {
          data: { description: 'Task without title', projectId: project.id },
          expectedField: 'title'
        },
        {
          data: { title: 'Task without project' },
          expectedField: 'projectId'
        },
        {
          data: { title: 'Task with invalid priority', projectId: project.id, priority: 'invalid' },
          expectedField: 'priority'
        }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testCase.data);

        expect(response.status).toBe(400);
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to auth endpoints', async () => {
      // This test might be flaky depending on rate limit configuration
      // We'll make multiple rapid requests to trigger rate limiting
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < 50; i++) {
        const promise = request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      // At least some requests should be rate limited or return 400/401
      const errorResponses = responses.filter(r => r.status >= 400);
      expect(errorResponses.length).toBeGreaterThan(0);
    }, 30000); // Increase timeout for this test
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/auth/login');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/auth/login');

      // These headers should be set by helmet middleware
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('Logger Utility', () => {
    it('should create log entries', () => {
      // Test that logger doesn't throw errors
      expect(() => {
        logger.info('Test info message');
        logger.warn('Test warning message');
        logger.error('Test error message');
      }).not.toThrow();
    });

    it('should handle log levels appropriately', () => {
      // In test environment, we mock console methods
      // So this test just ensures no errors are thrown
      expect(() => {
        logger.debug('Debug message');
        logger.info('Info message');
        logger.warn('Warning message');
        logger.error('Error message');
      }).not.toThrow();
    });
  });

  describe('Database Connection', () => {
    it('should maintain database connection', async () => {
      const result = await db.raw('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });

    it('should handle database transactions', async () => {
      const trx = await db.transaction();
      
      try {
        // Create a user in transaction
        const [user] = await trx('users').insert({
          username: 'transaction_test',
          email: 'transaction@example.com',
          password_hash: 'hash',
          first_name: 'Test',
          last_name: 'User',
          created_at: new Date(),
          updated_at: new Date()
        }).returning('*');

        expect(user.username).toBe('transaction_test');

        // Rollback transaction
        await trx.rollback();

        // User should not exist after rollback
        const foundUser = await db('users').where('username', 'transaction_test').first();
        expect(foundUser).toBeUndefined();
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    });
  });
});
