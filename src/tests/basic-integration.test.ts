import request from 'supertest';
import { createTestApp } from './utils/testApp';
import { createAuthTest } from './utils/authTestHelpers';

describe('Basic Integration Tests', () => {
  const app = createTestApp();
  const { generateTestToken } = createAuthTest();
  
  // Test user for authentication tests
  const testUser = {
    id: 'test-uuid-123',
    email: 'test@example.com',
    username: 'testuser'
  };
  
  describe('Health Check', () => {
    it('should return 200 OK for health endpoint', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
    });
  });
  
  describe('Public Endpoint', () => {
    it('should allow access to public endpoint without auth', async () => {
      const response = await request(app).get('/api/test/public');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Public endpoint');
    });
  });
  
  describe('Protected Endpoint', () => {
    it('should deny access without a valid token', async () => {
      const response = await request(app).get('/api/test/auth');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should allow access with a valid token', async () => {
      const token = generateTestToken(testUser);
      const response = await request(app)
        .get('/api/test/auth')
        .set('Authorization', `Bearer ${token}`);
        
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', testUser.id);
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).toHaveProperty('username', testUser.username);
    });
    
    it('should reject invalid token formats', async () => {
      const response = await request(app)
        .get('/api/test/auth')
        .set('Authorization', 'invalid-token-format');
        
      expect(response.status).toBe(401);
    });
  });
  
  describe('Not Found Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/non-existent-route');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Route not found');
    });
  });
});
