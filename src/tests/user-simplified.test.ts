import request from 'supertest';
import { createTestApp } from './utils/testApp';
import { createAuthTest } from './utils/authTestHelpers';

describe('User Controller Tests', () => {
  const app = createTestApp();
  const { generateTestToken } = createAuthTest();

  const testUser = {
    id: 'test-uuid-456',
    username: 'testuser',
    email: 'test@example.com'
  };

  describe('User Profile', () => {
    it('should respond with 401 if no token provided', async () => {
      const response = await request(app).get('/api/test/auth');
      expect(response.status).toBe(401);
    });

    it('should respond with user profile when authenticated', async () => {
      const token = generateTestToken(testUser);
      
      const response = await request(app)
        .get('/api/test/auth')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', testUser.id);
      expect(response.body.user).toHaveProperty('username', testUser.username);
    });
  });
});
