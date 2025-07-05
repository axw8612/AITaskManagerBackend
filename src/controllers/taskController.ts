import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { db } from '../database/connection';
import { logger } from '../utils/logger';

class TaskController {
  getTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        status = 'all', 
        priority = 'all',
        projectId,
        assignedToMe = 'false',
        sortBy = 'updated_at',
        sortOrder = 'desc'
      } = req.query;
      
      const offset = (Number(page) - 1) * Number(limit);
      
      let query = db('tasks')
        .join('projects', 'tasks.project_id', 'projects.id')
        .join('project_members', 'projects.id', 'project_members.project_id')
        .where('project_members.user_id', userId)
        .leftJoin('users as assignee', 'tasks.assigned_to', 'assignee.id')
        .select(
          'tasks.id',
          'tasks.title',
          'tasks.description',
          'tasks.status',
          'tasks.priority',
          'tasks.due_date',
          'tasks.created_at',
          'tasks.updated_at',
          'tasks.assigned_to',
          'tasks.project_id',
          'projects.name as project_name',
          'assignee.username as assignee_username',
          'assignee.first_name as assignee_first_name',
          'assignee.last_name as assignee_last_name'
        );
      
      // Add search filter
      if (search) {
        query = query.where(function() {
          this.where('tasks.title', 'ilike', `%${search}%`)
              .orWhere('tasks.description', 'ilike', `%${search}%`);
        });
      }
      
      // Add status filter
      if (status !== 'all') {
        query = query.where('tasks.status', status);
      }
      
      // Add priority filter
      if (priority !== 'all') {
        query = query.where('tasks.priority', priority);
      }
      
      // Add project filter
      if (projectId) {
        query = query.where('tasks.project_id', projectId);
      }
      
      // Add assigned to me filter
      if (assignedToMe === 'true') {
        query = query.where('tasks.assigned_to', userId);
      }
      
      // Get total count
      const totalQuery = query.clone();
      const countResult = await totalQuery.count('* as count');
      const total = Number((countResult[0] as any)?.count || 0);
      
      // Add sorting
      const validSortFields = ['title', 'status', 'priority', 'due_date', 'created_at', 'updated_at'];
      const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'updated_at';
      const order = sortOrder === 'asc' ? 'asc' : 'desc';
      
      // Get tasks with pagination
      const tasks = await query
        .orderBy(`tasks.${sortField}`, order)
        .limit(Number(limit))
        .offset(offset);
      
      res.json({
        success: true,
        data: {
          tasks: tasks.map(task => ({
            ...task,
            assignee: task.assigned_to ? {
              id: task.assigned_to,
              username: task.assignee_username,
              first_name: task.assignee_first_name,
              last_name: task.assignee_last_name
            } : null
          })),
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: total,
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Get tasks error:', error);
      throw error;
    }
  });

  getTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      
      // Get task with project and assignee information
      const task = await db('tasks')
        .join('projects', 'tasks.project_id', 'projects.id')
        .join('project_members', 'projects.id', 'project_members.project_id')
        .where('project_members.user_id', userId)
        .where('tasks.id', id)
        .leftJoin('users as assignee', 'tasks.assigned_to', 'assignee.id')
        .leftJoin('users as creator', 'tasks.created_by', 'creator.id')
        .select(
          'tasks.*',
          'projects.name as project_name',
          'project_members.role as user_role',
          'assignee.username as assignee_username',
          'assignee.first_name as assignee_first_name',
          'assignee.last_name as assignee_last_name',
          'assignee.email as assignee_email',
          'creator.username as creator_username',
          'creator.first_name as creator_first_name',
          'creator.last_name as creator_last_name'
        )
        .first();
      
      if (!task) {
        throw new AppError('Task not found or access denied', 404);
      }
      
      // Get task attachments
      const attachments = await db('task_attachments')
        .where('task_id', id)
        .select('*');
      
      res.json({
        success: true,
        data: {
          task: {
            ...task,
            assignee: task.assigned_to ? {
              id: task.assigned_to,
              username: task.assignee_username,
              first_name: task.assignee_first_name,
              last_name: task.assignee_last_name,
              email: task.assignee_email
            } : null,
            creator: {
              id: task.created_by,
              username: task.creator_username,
              first_name: task.creator_first_name,
              last_name: task.creator_last_name
            },
            attachments
          }
        }
      });
    } catch (error) {
      logger.error('Get task error:', error);
      throw error;
    }
  });

  createTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { 
        title, 
        description, 
        projectId, 
        assignedTo, 
        priority = 'medium', 
        status = 'todo',
        dueDate 
      } = req.body;
      const userId = req.user!.id;
      
      if (!title || !projectId) {
        throw new AppError('Title and project ID are required', 400);
      }
      
      // Check if user has permission to create tasks in this project
      const membership = await db('project_members')
        .where({ project_id: projectId, user_id: userId })
        .first();
      
      if (!membership) {
        throw new AppError('Permission denied - not a member of this project', 403);
      }
      
      // If assignedTo is provided, check if that user is a member of the project
      if (assignedTo) {
        const assigneeMembership = await db('project_members')
          .where({ project_id: projectId, user_id: assignedTo })
          .first();
        
        if (!assigneeMembership) {
          throw new AppError('Cannot assign task to user who is not a project member', 400);
        }
      }
      
      // Create task
      const [task] = await db('tasks')
        .insert({
          title: title.trim(),
          description: description?.trim() || null,
          project_id: projectId,
          assigned_to: assignedTo || null,
          created_by: userId,
          priority,
          status,
          due_date: dueDate ? new Date(dueDate) : null,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');
      
      // Get the created task with related information
      const taskWithDetails = await db('tasks')
        .join('projects', 'tasks.project_id', 'projects.id')
        .where('tasks.id', task.id)
        .leftJoin('users as assignee', 'tasks.assigned_to', 'assignee.id')
        .select(
          'tasks.*',
          'projects.name as project_name',
          'assignee.username as assignee_username',
          'assignee.first_name as assignee_first_name',
          'assignee.last_name as assignee_last_name'
        )
        .first();
      
      logger.info(`Task created: ${task.title} in project ${projectId} by user ${userId}`);
      
      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: {
          task: {
            ...taskWithDetails,
            assignee: taskWithDetails.assigned_to ? {
              id: taskWithDetails.assigned_to,
              username: taskWithDetails.assignee_username,
              first_name: taskWithDetails.assignee_first_name,
              last_name: taskWithDetails.assignee_last_name
            } : null
          }
        }
      });
    } catch (error) {
      logger.error('Create task error:', error);
      throw error;
    }
  });

  updateTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { 
        title, 
        description, 
        assignedTo, 
        priority, 
        status,
        dueDate 
      } = req.body;
      const userId = req.user!.id;
      
      // Check if user has permission to update this task
      const taskAccess = await db('tasks')
        .join('projects', 'tasks.project_id', 'projects.id')
        .join('project_members', 'projects.id', 'project_members.project_id')
        .where('project_members.user_id', userId)
        .where('tasks.id', id)
        .select('tasks.*', 'project_members.role as user_role')
        .first();
      
      if (!taskAccess) {
        throw new AppError('Task not found or access denied', 404);
      }
      
      // If assignedTo is being changed, check if the new assignee is a project member
      if (assignedTo !== undefined && assignedTo !== null) {
        const assigneeMembership = await db('project_members')
          .where({ project_id: taskAccess.project_id, user_id: assignedTo })
          .first();
        
        if (!assigneeMembership) {
          throw new AppError('Cannot assign task to user who is not a project member', 400);
        }
      }
      
      // Update task
      const [task] = await db('tasks')
        .where('id', id)
        .update({
          ...(title && { title: title.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(assignedTo !== undefined && { assigned_to: assignedTo }),
          ...(priority && { priority }),
          ...(status && { status }),
          ...(dueDate !== undefined && { due_date: dueDate ? new Date(dueDate) : null }),
          updated_at: new Date()
        })
        .returning('*');
      
      if (!task) {
        throw new AppError('Task not found', 404);
      }
      
      logger.info(`Task updated: ${task.title} by user ${userId}`);
      
      res.json({
        success: true,
        message: 'Task updated successfully',
        data: {
          task
        }
      });
    } catch (error) {
      logger.error('Update task error:', error);
      throw error;
    }
  });

  deleteTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      
      // Check if user has permission to delete this task
      const taskAccess = await db('tasks')
        .join('projects', 'tasks.project_id', 'projects.id')
        .join('project_members', 'projects.id', 'project_members.project_id')
        .where('project_members.user_id', userId)
        .where('tasks.id', id)
        .select('tasks.*', 'project_members.role as user_role')
        .first();
      
      if (!taskAccess) {
        throw new AppError('Task not found or access denied', 404);
      }
      
      // Only allow task creator, project owners, or admins to delete tasks
      if (taskAccess.created_by !== userId && !['owner', 'admin'].includes(taskAccess.user_role)) {
        throw new AppError('Permission denied - only task creator or project admins can delete tasks', 403);
      }
      
      // Delete task and related records
      await db.transaction(async (trx) => {
        // Delete task attachments
        await trx('task_attachments').where('task_id', id).del();
        
        // Delete task
        await trx('tasks').where('id', id).del();
      });
      
      logger.info(`Task deleted: ${id} by user ${userId}`);
      
      res.json({
        success: true,
        message: 'Task deleted successfully'
      });
    } catch (error) {
      logger.error('Delete task error:', error);
      throw error;
    }
  });

  addAttachment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { fileName, fileUrl, fileSize, mimeType } = req.body;
      const userId = req.user!.id;
      
      if (!fileName || !fileUrl) {
        throw new AppError('File name and URL are required', 400);
      }
      
      // Check if user has permission to add attachments to this task
      const taskAccess = await db('tasks')
        .join('projects', 'tasks.project_id', 'projects.id')
        .join('project_members', 'projects.id', 'project_members.project_id')
        .where('project_members.user_id', userId)
        .where('tasks.id', id)
        .first();
      
      if (!taskAccess) {
        throw new AppError('Task not found or access denied', 404);
      }
      
      // Add attachment
      const [attachment] = await db('task_attachments')
        .insert({
          task_id: id,
          file_name: fileName.trim(),
          file_url: fileUrl.trim(),
          file_size: fileSize || null,
          mime_type: mimeType || null,
          uploaded_by: userId,
          uploaded_at: new Date()
        })
        .returning('*');
      
      logger.info(`Attachment added to task ${id}: ${fileName} by user ${userId}`);
      
      res.status(201).json({
        success: true,
        message: 'Attachment added successfully',
        data: {
          attachment
        }
      });
    } catch (error) {
      logger.error('Add attachment error:', error);
      throw error;
    }
  });

  removeAttachment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, attachmentId } = req.params;
      const userId = req.user!.id;
      
      // Check if user has permission to remove attachments from this task
      const taskAccess = await db('tasks')
        .join('projects', 'tasks.project_id', 'projects.id')
        .join('project_members', 'projects.id', 'project_members.project_id')
        .where('project_members.user_id', userId)
        .where('tasks.id', id)
        .select('project_members.role as user_role')
        .first();
      
      if (!taskAccess) {
        throw new AppError('Task not found or access denied', 404);
      }
      
      // Check if attachment exists
      const attachment = await db('task_attachments')
        .where({ id: attachmentId, task_id: id })
        .first();
      
      if (!attachment) {
        throw new AppError('Attachment not found', 404);
      }
      
      // Only allow attachment uploader or project admins to remove attachments
      if (attachment.uploaded_by !== userId && !['owner', 'admin'].includes(taskAccess.user_role)) {
        throw new AppError('Permission denied - only attachment uploader or project admins can remove attachments', 403);
      }
      
      // Remove attachment
      await db('task_attachments')
        .where({ id: attachmentId, task_id: id })
        .del();
      
      logger.info(`Attachment removed from task ${id}: ${attachmentId} by user ${userId}`);
      
      res.json({
        success: true,
        message: 'Attachment removed successfully'
      });
    } catch (error) {
      logger.error('Remove attachment error:', error);
      throw error;
    }
  });
}

export const taskController = new TaskController();
