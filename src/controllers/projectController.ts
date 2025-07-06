import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { db } from '../database/connection';
import { logger } from '../utils/logger';

class ProjectController {
  getProjects = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { page = 1, limit = 10, search = '', status = 'all' } = req.query;
      
      const offset = (Number(page) - 1) * Number(limit);
      
      let query = db('projects')
        .join('project_members', 'projects.id', 'project_members.project_id')
        .where('project_members.user_id', userId)
        .select(
          'projects.id',
          'projects.name',
          'projects.description',
          'projects.status',
          'projects.created_at',
          'projects.updated_at',
          'project_members.role as member_role'
        );
      
      // Add search filter
      if (search) {
        query = query.where(function() {
          this.where('projects.name', 'ilike', `%${search}%`)
              .orWhere('projects.description', 'ilike', `%${search}%`);
        });
      }
      
      // Add status filter
      if (status !== 'all') {
        query = query.where('projects.status', status);
      }
      
      // Get total count
      const totalQuery = query.clone();
      const countResult = await totalQuery.count('* as count');
      const total = Number((countResult[0] as any)?.count || 0);
      
      // Get projects with pagination
      const projects = await query
        .orderBy('projects.updated_at', 'desc')
        .limit(Number(limit))
        .offset(offset);
      
      // Get member counts for each project
      const projectIds = projects.map(p => p.id);
      const memberCounts = await db('project_members')
        .select('project_id')
        .count('* as member_count')
        .whereIn('project_id', projectIds)
        .groupBy('project_id');
      
      // Add member counts to projects
      const projectsWithCounts = projects.map(project => {
        const memberCount = memberCounts.find(mc => (mc as any).project_id === project.id);
        return {
          ...project,
          memberCount: memberCount ? Number((memberCount as any).member_count) : 0
        };
      });
      
      res.json({
        success: true,
        data: {
          projects: projectsWithCounts,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: total,
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Get projects error:', error);
      throw error;
    }
  });

  getProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      
      // Check if user is a member of the project
      const membership = await db('project_members')
        .where({ project_id: id, user_id: userId })
        .first();
      
      if (!membership) {
        throw new AppError('Project not found or access denied', 404);
      }
      
      // Get project details
      const project = await db('projects')
        .where('id', id)
        .first();
      
      if (!project) {
        throw new AppError('Project not found', 404);
      }
      
      // Get project members
      const members = await db('project_members')
        .join('users', 'project_members.user_id', 'users.id')
        .where('project_members.project_id', id)
        .select(
          'users.id',
          'users.username',
          'users.email',
          'users.first_name',
          'users.last_name',
          'project_members.role',
          'project_members.joined_at'
        );
      
      // Get project tasks count
      const taskCountResult = await db('tasks')
        .where('project_id', id)
        .count('* as count');
      const taskCount = Number((taskCountResult[0] as any)?.count || 0);
      
      res.json({
        success: true,
        data: {
          project: {
            ...project,
            memberRole: membership.role,
            taskCount: taskCount
          },
          members
        }
      });
    } catch (error) {
      logger.error('Get project error:', error);
      throw error;
    }
  });

  createProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, status = 'active' } = req.body;
      const userId = req.user!.id;
      
      if (!name) {
        throw new AppError('Project name is required', 400);
      }
      
      // Start transaction
      const result = await db.transaction(async (trx) => {
        // Create project
        const [project] = await trx('projects')
          .insert({
            name: name.trim(),
            description: description?.trim() || null,
            status,
            owner_id: userId, // Changed from created_by to owner_id
            created_at: new Date(),
            updated_at: new Date()
          })
          .returning('*');
        
        // Add creator as project owner
        await trx('project_members')
          .insert({
            project_id: project.id,
            user_id: userId,
            role: 'owner',
            joined_at: new Date()
          });
        
        return project;
      });
      
      logger.info(`Project created: ${result.name} by user ${userId}`);
      
      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: {
          project: result
        }
      });
    } catch (error) {
      logger.error('Create project error:', error);
      throw error;
    }
  });

  updateProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, status } = req.body;
      const userId = req.user!.id;
      
      // Check if user has permission to update project
      const membership = await db('project_members')
        .where({ project_id: id, user_id: userId })
        .whereIn('role', ['owner', 'admin'])
        .first();
      
      if (!membership) {
        throw new AppError('Permission denied', 403);
      }
      
      // Update project
      const [project] = await db('projects')
        .where('id', id)
        .update({
          ...(name && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(status && { status }),
          updated_at: new Date()
        })
        .returning('*');
      
      if (!project) {
        throw new AppError('Project not found', 404);
      }
      
      logger.info(`Project updated: ${project.name} by user ${userId}`);
      
      res.json({
        success: true,
        message: 'Project updated successfully',
        data: {
          project
        }
      });
    } catch (error) {
      logger.error('Update project error:', error);
      throw error;
    }
  });

  deleteProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      
      // Check if user is project owner
      const membership = await db('project_members')
        .where({ project_id: id, user_id: userId, role: 'owner' })
        .first();
      
      if (!membership) {
        throw new AppError('Permission denied - only project owner can delete project', 403);
      }
      
      // Check if project has tasks
      const taskCountResult = await db('tasks')
        .where('project_id', id)
        .count('* as count');
      const taskCount = Number((taskCountResult[0] as any)?.count || 0);
      
      if (taskCount > 0) {
        throw new AppError('Cannot delete project with existing tasks', 400);
      }
      
      // Delete project and related records
      await db.transaction(async (trx) => {
        // Delete project members
        await trx('project_members').where('project_id', id).del();
        
        // Delete project
        await trx('projects').where('id', id).del();
      });
      
      logger.info(`Project deleted: ${id} by user ${userId}`);
      
      res.json({
        success: true,
        message: 'Project deleted successfully'
      });
    } catch (error) {
      logger.error('Delete project error:', error);
      throw error;
    }
  });

  addMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { userId: memberUserId, role = 'member' } = req.body;
      const userId = req.user!.id;
      
      if (!memberUserId) {
        throw new AppError('User ID is required', 400);
      }
      
      // Check if user has permission to add members
      const membership = await db('project_members')
        .where({ project_id: id, user_id: userId })
        .whereIn('role', ['owner', 'admin'])
        .first();
      
      if (!membership) {
        throw new AppError('Permission denied', 403);
      }
      
      // Check if user to be added exists
      const userToAdd = await db('users')
        .where({ id: memberUserId, is_active: true })
        .first();
      
      if (!userToAdd) {
        throw new AppError('User not found', 404);
      }
      
      // Check if user is already a member
      const existingMembership = await db('project_members')
        .where({ project_id: id, user_id: memberUserId })
        .first();
      
      if (existingMembership) {
        throw new AppError('User is already a member of this project', 400);
      }
      
      // Add member
      await db('project_members')
        .insert({
          project_id: id,
          user_id: memberUserId,
          role,
          joined_at: new Date()
        });
      
      logger.info(`Member added to project ${id}: user ${memberUserId} with role ${role}`);
      
      res.status(201).json({
        success: true,
        message: 'Member added successfully',
        data: {
          member: {
            id: userToAdd.id,
            username: userToAdd.username,
            email: userToAdd.email,
            first_name: userToAdd.first_name,
            last_name: userToAdd.last_name,
            role,
            joined_at: new Date()
          }
        }
      });
    } catch (error) {
      logger.error('Add member error:', error);
      throw error;
    }
  });

  removeMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, userId: memberUserId } = req.params;
      const userId = req.user!.id;
      
      // Check if user has permission to remove members
      const membership = await db('project_members')
        .where({ project_id: id, user_id: userId })
        .whereIn('role', ['owner', 'admin'])
        .first();
      
      if (!membership) {
        throw new AppError('Permission denied', 403);
      }
      
      // Check if member exists
      const memberToRemove = await db('project_members')
        .where({ project_id: id, user_id: memberUserId })
        .first();
      
      if (!memberToRemove) {
        throw new AppError('Member not found', 404);
      }
      
      // Prevent removing the last owner
      if (memberToRemove.role === 'owner') {
        const ownerCountResult = await db('project_members')
          .where({ project_id: id, role: 'owner' })
          .count('* as count');
        const ownerCount = Number((ownerCountResult[0] as any)?.count || 0);
        
        if (ownerCount === 1) {
          throw new AppError('Cannot remove the last owner of the project', 400);
        }
      }
      
      // Remove member
      await db('project_members')
        .where({ project_id: id, user_id: memberUserId })
        .del();
      
      logger.info(`Member removed from project ${id}: user ${memberUserId}`);
      
      res.json({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      logger.error('Remove member error:', error);
      throw error;
    }
  });

  archiveProject = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      
      // Check if user has permission to archive project
      const membership = await db('project_members')
        .where({ project_id: id, user_id: userId })
        .whereIn('role', ['owner', 'admin'])
        .first();
      
      if (!membership) {
        throw new AppError('Permission denied', 403);
      }
      
      // Archive project
      const [project] = await db('projects')
        .where('id', id)
        .update({
          status: 'archived',
          updated_at: new Date()
        })
        .returning('*');
      
      if (!project) {
        throw new AppError('Project not found', 404);
      }
      
      logger.info(`Project archived: ${project.name} by user ${userId}`);
      
      res.json({
        success: true,
        message: 'Project archived successfully',
        data: {
          project
        }
      });
    } catch (error) {
      logger.error('Archive project error:', error);
      throw error;
    }
  });
}

export const projectController = new ProjectController();
