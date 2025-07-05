import request from 'supertest';
import { app } from '../../index';
import { TestHelpers, TestData } from '../utils/testHelpers';
import { db } from '../../database/connection';
import bcrypt from 'bcryptjs';

describe('Auth Controller', () => {
  beforeEach(async () => {
    await TestHelpers.cleanDatabase();
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase();
    await db.destroy();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.valid);

      TestHelpers.expectSuccessResponse(response, 201);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe(TestData.user.valid.email);
      expect(response.body.data.user.username).toBe(TestData.user.valid.username);
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should reject registration with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.invalid.missingEmail);

      TestHelpers.expectValidationError(response, 'email');
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.invalid.invalidEmail);

      TestHelpers.expectValidationError(response, 'email');
    });

    it('should reject registration with short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.invalid.shortPassword);

      TestHelpers.expectValidationError(response, 'password');
    });

    it('should reject duplicate email registration', async () => {
      // Create first user
      await TestHelpers.createTestUser({ email: TestData.user.valid.email });

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(TestData.user.valid);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.toLowerCase()).toContain('email');
    });

    it('should reject duplicate username registration', async () => {
      // Create first user
      await TestHelpers.createTestUser({ username: TestData.user.valid.username });

      // Try to register with same username
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...TestData.user.valid,
          email: 'different@example.com'
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.toLowerCase()).toContain('username');
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await TestHelpers.createTestUser({
        email: TestData.user.valid.email,
        username: TestData.user.valid.username
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: TestData.user.valid.email,
          password: 'password123' // Default password from TestHelpers
        });

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(TestData.user.valid.email);
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'password123'
        });

      TestHelpers.expectAuthenticationError(response);
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: TestData.user.valid.email,
          password: 'wrongpassword'
        });

      TestHelpers.expectAuthenticationError(response);
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      TestHelpers.expectValidationError(response);
    });

    it('should reject login for inactive user', async () => {
      // Deactivate user
      await db('users').where('id', testUser.id).update({ is_active: false });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: TestData.user.valid.email,
          password: 'password123'
        });

      TestHelpers.expectAuthenticationError(response);
    });

    it('should update last_login timestamp on successful login', async () => {
      const beforeLogin = new Date();
      
      await request(app)
        .post('/api/auth/login')
        .send({
          email: TestData.user.valid.email,
          password: 'password123'
        });

      const updatedUser = await db('users').where('id', testUser.id).first();
      expect(new Date(updatedUser.last_login)).toBeInstanceOf(Date);
      expect(new Date(updatedUser.last_login).getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });
  });

  describe('POST /api/auth/logout', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await TestHelpers.createTestUser();
    });

    it('should logout successfully with valid token', async () => {
      const response = await TestHelpers.authenticatedRequest('post', '/api/auth/logout', testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.message).toContain('Logged out successfully');
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      TestHelpers.expectAuthenticationError(response);
    });

    it('should reject logout with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token');

      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await TestHelpers.createTestUser();
    });

    it('should refresh token successfully', async () => {
      const refreshToken = TestHelpers.generateAuthToken(testUser);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      TestHelpers.expectAuthenticationError(response);
    });

    it('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      TestHelpers.expectValidationError(response, 'refresh token');
    });

    it('should reject refresh for inactive user', async () => {
      const refreshToken = TestHelpers.generateAuthToken(testUser);
      
      // Deactivate user
      await db('users').where('id', testUser.id).update({ is_active: false });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await TestHelpers.createTestUser({
        email: TestData.user.valid.email
      });
    });

    it('should handle forgot password request for existing user', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: TestData.user.valid.email });

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.message).toContain('password reset link');

      // Check that a reset token was created
      const resetToken = await db('password_reset_tokens')
        .where('user_id', testUser.id)
        .first();
      expect(resetToken).toBeTruthy();
    });

    it('should handle forgot password request for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      // Should still return success to prevent email enumeration
      TestHelpers.expectSuccessResponse(response);
      expect(response.body.message).toContain('password reset link');
    });

    it('should reject forgot password request without email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({});

      TestHelpers.expectValidationError(response, 'email');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let testUser: any;
    let resetToken: string;

    beforeEach(async () => {
      testUser = await TestHelpers.createTestUser();
      resetToken = 'test-reset-token';
      await TestHelpers.createPasswordResetToken(testUser.id, resetToken);
    });

    it('should reset password with valid token', async () => {
      const newPassword = 'newpassword123';
      
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword
        });

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.message).toContain('Password reset successful');

      // Verify password was actually changed
      const updatedUser = await db('users').where('id', testUser.id).first();
      const isPasswordValid = await bcrypt.compare(newPassword, updatedUser.password_hash);
      expect(isPasswordValid).toBe(true);

      // Verify token was marked as used
      const usedToken = await db('password_reset_tokens')
        .where('token', resetToken)
        .first();
      expect(usedToken.used).toBe(true);
    });

    it('should reject password reset with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid or expired');
    });

    it('should reject password reset with expired token', async () => {
      // Create expired token
      await db('password_reset_tokens')
        .where('token', resetToken)
        .update({ expires_at: new Date(Date.now() - 1000) }); // 1 second ago

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid or expired');
    });

    it('should reject password reset with used token', async () => {
      // Mark token as used
      await db('password_reset_tokens')
        .where('token', resetToken)
        .update({ used: true });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid or expired');
    });

    it('should reject password reset with short password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: '123'
        });

      TestHelpers.expectValidationError(response, 'password');
    });

    it('should reject password reset without required fields', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({});

      TestHelpers.expectValidationError(response);
    });
  });
});
