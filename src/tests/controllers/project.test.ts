import request from 'supertest';
import { app } from '../../index';
import { TestHelpers, TestData } from '../utils/testHelpers';
import { db } from '../../database/connection';

describe('Project Controller', () => {
  let testUser: any;
  let otherUser: any;
  let testProject: any;

  beforeEach(async () => {
    await TestHelpers.cleanDatabase();
    testUser = await TestHelpers.createTestUser({
      username: 'projectowner',
      email: 'owner@example.com'
    });
    otherUser = await TestHelpers.createTestUser({
      username: 'projectmember',
      email: 'member@example.com'
    });
    testProject = await TestHelpers.createTestProject(testUser.id);
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase();
    await db.destroy();
  });

  describe('GET /api/projects', () => {
    beforeEach(async () => {
      // Add other user as member to test project
      await TestHelpers.addProjectMember(testProject.id, otherUser.id, 'member');
      
      // Create additional projects
      await TestHelpers.createTestProject(testUser.id, { name: 'Second Project' });
      await TestHelpers.createTestProject(otherUser.id, { name: 'Other User Project' });
    });

    it('should get user projects successfully', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/projects', testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.projects).toHaveLength(2); // Owner of 2 projects
      expect(response.body.data.pagination).toHaveProperty('total', 2);
    });

    it('should get projects for member', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/projects', otherUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.projects).toHaveLength(2); // Member of 1 + Owner of 1
    });

    it('should support pagination', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/projects?page=1&limit=1', testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.projects).toHaveLength(1);
      expect(response.body.data.pagination).toHaveProperty('page', 1);
      expect(response.body.data.pagination).toHaveProperty('limit', 1);
    });

    it('should support search', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/projects?search=Second', testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.projects).toHaveLength(1);
      expect(response.body.data.projects[0].name).toContain('Second');
    });

    it('should support status filtering', async () => {
      // Create archived project
      await TestHelpers.createTestProject(testUser.id, { 
        name: 'Archived Project',
        status: 'archived'
      });

      const response = await TestHelpers.authenticatedRequest('get', '/api/projects?status=archived', testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.projects).toHaveLength(1);
      expect(response.body.data.projects[0].status).toBe('archived');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).get('/api/projects');
      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('GET /api/projects/:id', () => {
    beforeEach(async () => {
      await TestHelpers.addProjectMember(testProject.id, otherUser.id, 'member');
      await TestHelpers.createTestTask(testProject.id, testUser.id);
    });

    it('should get project details for owner', async () => {
      const response = await TestHelpers.authenticatedRequest('get', `/api/projects/${testProject.id}`, testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.project).toHaveProperty('id', testProject.id);
      expect(response.body.data.project).toHaveProperty('name', testProject.name);
      expect(response.body.data.project).toHaveProperty('memberRole', 'owner');
      expect(response.body.data.project).toHaveProperty('taskCount', 1);
      expect(response.body.data.members).toHaveLength(2);
    });

    it('should get project details for member', async () => {
      const response = await TestHelpers.authenticatedRequest('get', `/api/projects/${testProject.id}`, otherUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.project).toHaveProperty('memberRole', 'member');
    });

    it('should reject access for non-member', async () => {
      const nonMember = await TestHelpers.createTestUser();
      const response = await TestHelpers.authenticatedRequest('get', `/api/projects/${testProject.id}`, nonMember);

      TestHelpers.expectNotFoundError(response);
    });

    it('should reject request for non-existent project', async () => {
      const response = await TestHelpers.authenticatedRequest('get', '/api/projects/99999', testUser);
      TestHelpers.expectNotFoundError(response);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).get(`/api/projects/${testProject.id}`);
      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('POST /api/projects', () => {
    it('should create project successfully', async () => {
      const projectData = TestData.project.valid;

      const response = await TestHelpers.authenticatedRequest('post', '/api/projects', testUser)
        .send(projectData);

      TestHelpers.expectSuccessResponse(response, 201);
      expect(response.body.data.project).toHaveProperty('id');
      expect(response.body.data.project).toHaveProperty('name', projectData.name);
      expect(response.body.data.project).toHaveProperty('description', projectData.description);
      expect(response.body.data.project).toHaveProperty('created_by', testUser.id);

      // Verify creator is added as owner
      const membership = await db('project_members')
        .where({ project_id: response.body.data.project.id, user_id: testUser.id })
        .first();
      expect(membership).toBeTruthy();
      expect(membership.role).toBe('owner');
    });

    it('should create project with minimal data', async () => {
      const projectData = { name: 'Minimal Project' };

      const response = await TestHelpers.authenticatedRequest('post', '/api/projects', testUser)
        .send(projectData);

      TestHelpers.expectSuccessResponse(response, 201);
      expect(response.body.data.project).toHaveProperty('name', projectData.name);
      expect(response.body.data.project.description).toBeNull();
    });

    it('should reject project creation without name', async () => {
      const response = await TestHelpers.authenticatedRequest('post', '/api/projects', testUser)
        .send(TestData.project.invalid.missingName);

      TestHelpers.expectValidationError(response, 'name');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send(TestData.project.valid);
      
      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update project as owner', async () => {
      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated description',
        status: 'on_hold'
      };

      const response = await TestHelpers.authenticatedRequest('put', `/api/projects/${testProject.id}`, testUser)
        .send(updateData);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.project.name).toBe(updateData.name);
      expect(response.body.data.project.description).toBe(updateData.description);
      expect(response.body.data.project.status).toBe(updateData.status);
    });

    it('should update project as admin', async () => {
      await TestHelpers.addProjectMember(testProject.id, otherUser.id, 'admin');
      
      const updateData = { name: 'Updated by Admin' };

      const response = await TestHelpers.authenticatedRequest('put', `/api/projects/${testProject.id}`, otherUser)
        .send(updateData);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.project.name).toBe(updateData.name);
    });

    it('should reject update as regular member', async () => {
      await TestHelpers.addProjectMember(testProject.id, otherUser.id, 'member');
      
      const updateData = { name: 'Unauthorized Update' };

      const response = await TestHelpers.authenticatedRequest('put', `/api/projects/${testProject.id}`, otherUser)
        .send(updateData);

      TestHelpers.expectAuthorizationError(response);
    });

    it('should reject update for non-existent project', async () => {
      const response = await TestHelpers.authenticatedRequest('put', '/api/projects/99999', testUser)
        .send({ name: 'Updated' });

      TestHelpers.expectAuthorizationError(response);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .put(`/api/projects/${testProject.id}`)
        .send({ name: 'Updated' });
      
      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete project as owner when no tasks exist', async () => {
      const response = await TestHelpers.authenticatedRequest('delete', `/api/projects/${testProject.id}`, testUser);

      TestHelpers.expectSuccessResponse(response);
      
      // Verify project is deleted
      const deletedProject = await db('projects').where('id', testProject.id).first();
      expect(deletedProject).toBeUndefined();
    });

    it('should reject delete when project has tasks', async () => {
      await TestHelpers.createTestTask(testProject.id, testUser.id);

      const response = await TestHelpers.authenticatedRequest('delete', `/api/projects/${testProject.id}`, testUser);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('existing tasks');
    });

    it('should reject delete as non-owner', async () => {
      await TestHelpers.addProjectMember(testProject.id, otherUser.id, 'admin');

      const response = await TestHelpers.authenticatedRequest('delete', `/api/projects/${testProject.id}`, otherUser);

      TestHelpers.expectAuthorizationError(response);
    });

    it('should reject delete for non-existent project', async () => {
      const response = await TestHelpers.authenticatedRequest('delete', '/api/projects/99999', testUser);
      TestHelpers.expectAuthorizationError(response);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).delete(`/api/projects/${testProject.id}`);
      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('POST /api/projects/:id/members', () => {
    it('should add member as owner', async () => {
      const memberData = {
        userId: otherUser.id,
        role: 'member'
      };

      const response = await TestHelpers.authenticatedRequest('post', `/api/projects/${testProject.id}/members`, testUser)
        .send(memberData);

      TestHelpers.expectSuccessResponse(response, 201);
      expect(response.body.data.member).toHaveProperty('id', otherUser.id);
      expect(response.body.data.member).toHaveProperty('role', 'member');

      // Verify in database
      const membership = await db('project_members')
        .where({ project_id: testProject.id, user_id: otherUser.id })
        .first();
      expect(membership).toBeTruthy();
      expect(membership.role).toBe('member');
    });

    it('should add admin as owner', async () => {
      const memberData = {
        userId: otherUser.id,
        role: 'admin'
      };

      const response = await TestHelpers.authenticatedRequest('post', `/api/projects/${testProject.id}/members`, testUser)
        .send(memberData);

      TestHelpers.expectSuccessResponse(response, 201);
      expect(response.body.data.member.role).toBe('admin');
    });

    it('should reject adding member as regular member', async () => {
      const thirdUser = await TestHelpers.createTestUser();
      await TestHelpers.addProjectMember(testProject.id, otherUser.id, 'member');

      const memberData = { userId: thirdUser.id };

      const response = await TestHelpers.authenticatedRequest('post', `/api/projects/${testProject.id}/members`, otherUser)
        .send(memberData);

      TestHelpers.expectAuthorizationError(response);
    });

    it('should reject adding non-existent user', async () => {
      const memberData = { userId: 99999 };

      const response = await TestHelpers.authenticatedRequest('post', `/api/projects/${testProject.id}/members`, testUser)
        .send(memberData);

      TestHelpers.expectNotFoundError(response);
    });

    it('should reject adding duplicate member', async () => {
      await TestHelpers.addProjectMember(testProject.id, otherUser.id, 'member');

      const memberData = { userId: otherUser.id };

      const response = await TestHelpers.authenticatedRequest('post', `/api/projects/${testProject.id}/members`, testUser)
        .send(memberData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already a member');
    });

    it('should reject request without userId', async () => {
      const response = await TestHelpers.authenticatedRequest('post', `/api/projects/${testProject.id}/members`, testUser)
        .send({});

      TestHelpers.expectValidationError(response, 'user id');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProject.id}/members`)
        .send({ userId: otherUser.id });
      
      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('DELETE /api/projects/:id/members/:userId', () => {
    beforeEach(async () => {
      await TestHelpers.addProjectMember(testProject.id, otherUser.id, 'member');
    });

    it('should remove member as owner', async () => {
      const response = await TestHelpers.authenticatedRequest('delete', `/api/projects/${testProject.id}/members/${otherUser.id}`, testUser);

      TestHelpers.expectSuccessResponse(response);

      // Verify member is removed
      const membership = await db('project_members')
        .where({ project_id: testProject.id, user_id: otherUser.id })
        .first();
      expect(membership).toBeUndefined();
    });

    it('should reject removing last owner', async () => {
      const response = await TestHelpers.authenticatedRequest('delete', `/api/projects/${testProject.id}/members/${testUser.id}`, testUser);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('last owner');
    });

    it('should reject removing member as regular member', async () => {
      const thirdUser = await TestHelpers.createTestUser();
      await TestHelpers.addProjectMember(testProject.id, thirdUser.id, 'member');

      const response = await TestHelpers.authenticatedRequest('delete', `/api/projects/${testProject.id}/members/${thirdUser.id}`, otherUser);

      TestHelpers.expectAuthorizationError(response);
    });

    it('should reject removing non-existent member', async () => {
      const response = await TestHelpers.authenticatedRequest('delete', `/api/projects/${testProject.id}/members/99999`, testUser);

      TestHelpers.expectNotFoundError(response);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProject.id}/members/${otherUser.id}`);
      
      TestHelpers.expectAuthenticationError(response);
    });
  });

  describe('PUT /api/projects/:id/archive', () => {
    it('should archive project as owner', async () => {
      const response = await TestHelpers.authenticatedRequest('put', `/api/projects/${testProject.id}/archive`, testUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.project.status).toBe('archived');

      // Verify in database
      const archivedProject = await db('projects').where('id', testProject.id).first();
      expect(archivedProject.status).toBe('archived');
    });

    it('should archive project as admin', async () => {
      await TestHelpers.addProjectMember(testProject.id, otherUser.id, 'admin');

      const response = await TestHelpers.authenticatedRequest('put', `/api/projects/${testProject.id}/archive`, otherUser);

      TestHelpers.expectSuccessResponse(response);
      expect(response.body.data.project.status).toBe('archived');
    });

    it('should reject archive as regular member', async () => {
      await TestHelpers.addProjectMember(testProject.id, otherUser.id, 'member');

      const response = await TestHelpers.authenticatedRequest('put', `/api/projects/${testProject.id}/archive`, otherUser);

      TestHelpers.expectAuthorizationError(response);
    });

    it('should reject archive for non-existent project', async () => {
      const response = await TestHelpers.authenticatedRequest('put', '/api/projects/99999/archive', testUser);
      TestHelpers.expectAuthorizationError(response);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).put(`/api/projects/${testProject.id}/archive`);
      TestHelpers.expectAuthenticationError(response);
    });
  });
});
