import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { db } from '../database/connection';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';

class UserController {
  getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const user = await db('users')
        .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'preferences', 'created_at', 'last_login')
        .where({ id: userId, is_active: true })
        .first();

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Parse preferences JSON
      user.preferences = typeof user.preferences === 'string' 
        ? JSON.parse(user.preferences) 
        : user.preferences || {};

      logger.info(`User profile retrieved for user: ${userId}`);
      
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Error getting user profile:', error);
      throw error;
    }
  });

  updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { first_name, last_name, preferences, current_password, new_password } = req.body;

      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      // Get current user data
      const currentUser = await db('users')
        .select('*')
        .where({ id: userId, is_active: true })
        .first();

      if (!currentUser) {
        throw new AppError('User not found', 404);
      }

      // Prepare update data
      const updateData: any = {};
      
      if (first_name !== undefined) updateData.first_name = first_name;
      if (last_name !== undefined) updateData.last_name = last_name;
      if (preferences !== undefined) updateData.preferences = JSON.stringify(preferences);

      // Handle password update
      if (new_password) {
        if (!current_password) {
          throw new AppError('Current password is required to set new password', 400);
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(current_password, currentUser.password_hash);
        if (!isCurrentPasswordValid) {
          throw new AppError('Current password is incorrect', 400);
        }

        // Hash new password
        updateData.password_hash = await bcrypt.hash(new_password, 10);
      }

      // Update user
      await db('users')
        .where({ id: userId })
        .update({ ...updateData, updated_at: new Date() });

      // Get updated user data (without password)
      const updatedUser = await db('users')
        .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'preferences', 'updated_at')
        .where({ id: userId })
        .first();

      // Parse preferences JSON
      updatedUser.preferences = typeof updatedUser.preferences === 'string' 
        ? JSON.parse(updatedUser.preferences) 
        : updatedUser.preferences || {};

      logger.info(`User profile updated for user: ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  });

  searchUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { q, role, limit = 10, offset = 0 } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        throw new AppError('Search query must be at least 2 characters long', 400);
      }

      let query = db('users')
        .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'created_at')
        .where('is_active', true)
        .where(function() {
          this.whereILike('username', `%${q}%`)
            .orWhereILike('first_name', `%${q}%`)
            .orWhereILike('last_name', `%${q}%`)
            .orWhereILike('email', `%${q}%`);
        });

      // Filter by role if specified
      if (role && typeof role === 'string') {
        query = query.where('role', role);
      }

      // Get total count for pagination
      const totalQuery = query.clone().clearSelect().count('* as count');
      const totalResult = await totalQuery;
      const total = parseInt((totalResult[0] as any)?.count || '0', 10);

      // Apply pagination
      const users = await query
        .limit(parseInt(limit as string, 10))
        .offset(parseInt(offset as string, 10))
        .orderBy('username', 'asc');

      logger.info(`User search performed: query="${q}", results=${users.length}`);

      res.status(200).json({
        success: true,
        data: users,
        pagination: {
          total,
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10),
          hasMore: parseInt(offset as string, 10) + users.length < total
        }
      });
    } catch (error) {
      logger.error('Error searching users:', error);
      throw error;
    }
  });

  getUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      const user = await db('users')
        .select('id', 'username', 'email', 'first_name', 'last_name', 'role', 'created_at', 'last_login')
        .where({ id, is_active: true })
        .first();

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Get user's project count and recent activity
      const projectCountResult = await db('project_members')
        .count('* as count')
        .where('user_id', id);

      const taskCountResult = await db('tasks')
        .count('* as count')
        .where('assignee_id', id)
        .where('status', '!=', 'done');

      const recentTasks = await db('tasks')
        .select('id', 'title', 'status', 'priority', 'created_at')
        .where('assignee_id', id)
        .orderBy('created_at', 'desc')
        .limit(5);

      logger.info(`User details retrieved for user: ${id}`);

      res.status(200).json({
        success: true,
        data: {
          ...user,
          stats: {
            project_count: parseInt((projectCountResult[0] as any)?.count || '0', 10),
            active_task_count: parseInt((taskCountResult[0] as any)?.count || '0', 10),
            recent_tasks: recentTasks
          }
        }
      });
    } catch (error) {
      logger.error('Error getting user details:', error);
      throw error;
    }
  });

  getUserProjects = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.query;

      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      // Verify user exists
      const user = await db('users')
        .select('id')
        .where({ id, is_active: true })
        .first();

      if (!user) {
        throw new AppError('User not found', 404);
      }

      let query = db('projects')
        .select(
          'projects.id',
          'projects.name', 
          'projects.description',
          'projects.status',
          'projects.created_at',
          'project_members.role'
        )
        .join('project_members', 'projects.id', 'project_members.project_id')
        .where('project_members.user_id', id);

      // Filter by status if provided
      if (status && typeof status === 'string') {
        query = query.where('projects.status', status);
      }

      const projects = await query.orderBy('projects.created_at', 'desc');

      logger.info(`Projects retrieved for user: ${id}, count: ${projects.length}`);

      res.status(200).json({
        success: true,
        data: projects
      });
    } catch (error) {
      logger.error('Error getting user projects:', error);
      throw error;
    }
  });

  getUserTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, priority, project_id, limit = 20, offset = 0 } = req.query;

      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      // Verify user exists
      const user = await db('users')
        .select('id')
        .where({ id, is_active: true })
        .first();

      if (!user) {
        throw new AppError('User not found', 404);
      }

      let query = db('tasks')
        .select(
          'tasks.id',
          'tasks.title',
          'tasks.description',
          'tasks.status',
          'tasks.priority',
          'tasks.due_date',
          'tasks.estimated_hours',
          'tasks.actual_hours',
          'tasks.created_at',
          'projects.name as project_name',
          'projects.id as project_id'
        )
        .join('projects', 'tasks.project_id', 'projects.id')
        .where('tasks.assignee_id', id);

      // Apply filters
      if (status && typeof status === 'string') {
        query = query.where('tasks.status', status);
      }
      if (priority && typeof priority === 'string') {
        query = query.where('tasks.priority', priority);
      }
      if (project_id && typeof project_id === 'string') {
        query = query.where('tasks.project_id', project_id);
      }

      // Get total count for pagination
      const totalQuery = query.clone().clearSelect().count('* as count');
      const totalResult = await totalQuery;
      const total = parseInt((totalResult[0] as any)?.count || '0', 10);

      // Apply pagination and ordering
      const tasks = await query
        .orderBy('tasks.created_at', 'desc')
        .limit(parseInt(limit as string, 10))
        .offset(parseInt(offset as string, 10));

      logger.info(`Tasks retrieved for user: ${id}, count: ${tasks.length}`);

      res.status(200).json({
        success: true,
        data: tasks,
        pagination: {
          total,
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10),
          hasMore: parseInt(offset as string, 10) + tasks.length < total
        }
      });
    } catch (error) {
      logger.error('Error getting user tasks:', error);
      throw error;
    }
  });
}

export const userController = new UserController();
