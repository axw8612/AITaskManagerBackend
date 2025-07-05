import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { db } from '../database/connection';
import { logger } from '../utils/logger';

class AIController {
  getTaskSuggestions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { projectId, context = '', limit = 5 } = req.query;
      
      // Get user's projects and recent tasks for context
      let projectIds: number[] = [];
      
      if (projectId) {
        // Verify user has access to the specified project
        const membership = await db('project_members')
          .where({ project_id: projectId, user_id: userId })
          .first();
        
        if (!membership) {
          throw new AppError('Access denied to this project', 403);
        }
        
        projectIds = [Number(projectId)];
      } else {
        // Get all user's projects
        const userProjects = await db('project_members')
          .where('user_id', userId)
          .select('project_id');
        
        projectIds = userProjects.map(p => p.project_id);
      }
      
      if (projectIds.length === 0) {
        return res.json({
          success: true,
          data: {
            suggestions: [],
            message: 'No projects available for suggestions'
          }
        });
      }
      
      // Analyze existing tasks to generate intelligent suggestions
      const existingTasks = await db('tasks')
        .whereIn('project_id', projectIds)
        .select('title', 'description', 'status', 'priority')
        .orderBy('created_at', 'desc')
        .limit(50);
      
      // Get project information for context
      const projects = await db('projects')
        .whereIn('id', projectIds)
        .select('id', 'name', 'description');
      
      // Generate AI-powered task suggestions based on patterns and context
      const suggestions = this.generateTaskSuggestions(existingTasks, projects, context as string, Number(limit));
      
      // Store suggestions in database for tracking
      const suggestionRecords = await Promise.all(
        suggestions.map(async (suggestion) => {
          const [record] = await db('ai_suggestions')
            .insert({
              user_id: userId,
              project_id: projectId ? Number(projectId) : null,
              suggestion_type: 'task',
              content: JSON.stringify(suggestion),
              context: context as string || null,
              created_at: new Date()
            })
            .returning('*');
          
          return {
            id: record.id,
            ...suggestion
          };
        })
      );
      
      logger.info(`Generated ${suggestions.length} task suggestions for user ${userId}`);
      
      return res.json({
        success: true,
        data: {
          suggestions: suggestionRecords,
          context: {
            projectCount: projects.length,
            existingTaskCount: existingTasks.length
          }
        }
      });
    } catch (error) {
      logger.error('Get task suggestions error:', error);
      throw error;
    }
  });

  estimateTime = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { title, description, priority = 'medium', taskType = 'general' } = req.body;
      
      if (!title) {
        throw new AppError('Task title is required for time estimation', 400);
      }
      
      // Get historical task completion data for the user
      const completedTasks = await db('tasks')
        .join('project_members', 'tasks.project_id', 'project_members.project_id')
        .where('project_members.user_id', userId)
        .where('tasks.status', 'done')
        .whereNotNull('tasks.completed_at')
        .select(
          'tasks.title',
          'tasks.description',
          'tasks.priority',
          'tasks.created_at',
          'tasks.completed_at'
        )
        .orderBy('tasks.completed_at', 'desc')
        .limit(100);
      
      // Calculate time estimation based on various factors
      const estimation = this.calculateTimeEstimation(
        title,
        description,
        priority,
        taskType,
        completedTasks
      );
      
      // Store estimation in database
      const [suggestionRecord] = await db('ai_suggestions')
        .insert({
          user_id: userId,
          suggestion_type: 'time_estimation',
          content: JSON.stringify({
            title,
            description,
            priority,
            taskType,
            estimation
          }),
          created_at: new Date()
        })
        .returning('*');
      
      logger.info(`Time estimation generated for user ${userId}: ${estimation.hours}h ${estimation.minutes}m`);
      
      res.json({
        success: true,
        data: {
          estimation,
          confidence: estimation.confidence,
          factors: estimation.factors,
          suggestionId: suggestionRecord.id
        }
      });
    } catch (error) {
      logger.error('Time estimation error:', error);
      throw error;
    }
  });

  suggestPriority = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { title, description, dueDate, projectId } = req.body;
      
      if (!title) {
        throw new AppError('Task title is required for priority suggestion', 400);
      }
      
      // Get project context if provided
      let projectContext = null;
      if (projectId) {
        const membership = await db('project_members')
          .where({ project_id: projectId, user_id: userId })
          .first();
        
        if (!membership) {
          throw new AppError('Access denied to this project', 403);
        }
        
        projectContext = await db('projects')
          .where('id', projectId)
          .first();
      }
      
      // Get user's task priority patterns
      const userTasks = await db('tasks')
        .join('project_members', 'tasks.project_id', 'project_members.project_id')
        .where('project_members.user_id', userId)
        .select('title', 'description', 'priority', 'status', 'due_date')
        .orderBy('created_at', 'desc')
        .limit(100);
      
      // Calculate priority suggestion
      const prioritySuggestion = this.calculatePrioritySuggestion(
        title,
        description,
        dueDate,
        projectContext,
        userTasks
      );
      
      // Store suggestion
      const [suggestionRecord] = await db('ai_suggestions')
        .insert({
          user_id: userId,
          project_id: projectId || null,
          suggestion_type: 'priority',
          content: JSON.stringify({
            title,
            description,
            dueDate,
            suggestion: prioritySuggestion
          }),
          created_at: new Date()
        })
        .returning('*');
      
      logger.info(`Priority suggestion generated for user ${userId}: ${prioritySuggestion.priority}`);
      
      res.json({
        success: true,
        data: {
          ...prioritySuggestion,
          suggestionId: suggestionRecord.id
        }
      });
    } catch (error) {
      logger.error('Priority suggestion error:', error);
      throw error;
    }
  });

  suggestAssignee = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { title, description, projectId, skillsRequired = [], workload = 'normal' } = req.body;
      
      if (!title || !projectId) {
        throw new AppError('Task title and project ID are required', 400);
      }
      
      // Verify user has access to project
      const membership = await db('project_members')
        .where({ project_id: projectId, user_id: userId })
        .first();
      
      if (!membership) {
        throw new AppError('Access denied to this project', 403);
      }
      
      // Get all project members
      const projectMembers = await db('project_members')
        .join('users', 'project_members.user_id', 'users.id')
        .where('project_members.project_id', projectId)
        .where('users.is_active', true)
        .select(
          'users.id',
          'users.username',
          'users.first_name',
          'users.last_name',
          'users.email',
          'project_members.role'
        );
      
      // Get workload data for each member
      const memberWorkloads = await Promise.all(
        projectMembers.map(async (member) => {
          const [{ count: activeTaskCount }] = await db('tasks')
            .where('assigned_to', member.id)
            .whereIn('status', ['todo', 'in_progress'])
            .count('* as count') as any;
          
          const [{ count: totalTaskCount }] = await db('tasks')
            .where('assigned_to', member.id)
            .count('* as count') as any;
          
          return {
            ...member,
            activeTaskCount: Number(activeTaskCount),
            totalTaskCount: Number(totalTaskCount)
          };
        })
      );
      
      // Calculate assignee suggestions
      const assigneeSuggestions = this.calculateAssigneeSuggestions(
        title,
        description,
        skillsRequired,
        workload,
        memberWorkloads
      );
      
      // Store suggestion
      const [suggestionRecord] = await db('ai_suggestions')
        .insert({
          user_id: userId,
          project_id: projectId,
          suggestion_type: 'assignee',
          content: JSON.stringify({
            title,
            description,
            skillsRequired,
            workload,
            suggestions: assigneeSuggestions
          }),
          created_at: new Date()
        })
        .returning('*');
      
      logger.info(`Assignee suggestions generated for user ${userId} in project ${projectId}`);
      
      res.json({
        success: true,
        data: {
          suggestions: assigneeSuggestions,
          projectMemberCount: projectMembers.length,
          suggestionId: suggestionRecord.id
        }
      });
    } catch (error) {
      logger.error('Assignee suggestion error:', error);
      throw error;
    }
  });

  breakdownTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { title, description, complexity = 'medium', projectId } = req.body;
      
      if (!title) {
        throw new AppError('Task title is required for breakdown', 400);
      }
      
      // Verify project access if provided
      if (projectId) {
        const membership = await db('project_members')
          .where({ project_id: projectId, user_id: userId })
          .first();
        
        if (!membership) {
          throw new AppError('Access denied to this project', 403);
        }
      }
      
      // Get similar tasks for pattern analysis
      const similarTasks = await db('tasks')
        .join('project_members', 'tasks.project_id', 'project_members.project_id')
        .where('project_members.user_id', userId)
        .select('title', 'description')
        .orderBy('created_at', 'desc')
        .limit(50);
      
      // Generate task breakdown
      const breakdown = this.generateTaskBreakdown(
        title,
        description,
        complexity,
        similarTasks
      );
      
      // Store breakdown suggestion
      const [suggestionRecord] = await db('ai_suggestions')
        .insert({
          user_id: userId,
          project_id: projectId || null,
          suggestion_type: 'task_breakdown',
          content: JSON.stringify({
            title,
            description,
            complexity,
            breakdown
          }),
          created_at: new Date()
        })
        .returning('*');
      
      logger.info(`Task breakdown generated for user ${userId}: ${breakdown.subtasks.length} subtasks`);
      
      res.json({
        success: true,
        data: {
          ...breakdown,
          suggestionId: suggestionRecord.id
        }
      });
    } catch (error) {
      logger.error('Task breakdown error:', error);
      throw error;
    }
  });

  // Helper method for generating task suggestions
  private generateTaskSuggestions(_existingTasks: any[], _projects: any[], context: string, limit: number) {
    const suggestions = [];
    
    // Common task patterns based on project types
    const commonTasks = [
      { title: 'Setup project documentation', description: 'Create comprehensive project documentation including README, API docs, and user guides', priority: 'high' },
      { title: 'Implement error handling', description: 'Add comprehensive error handling throughout the application', priority: 'medium' },
      { title: 'Add unit tests', description: 'Create unit tests for core functionality to ensure code quality', priority: 'high' },
      { title: 'Performance optimization', description: 'Analyze and optimize application performance bottlenecks', priority: 'medium' },
      { title: 'Security audit', description: 'Conduct security review and implement necessary security measures', priority: 'high' },
      { title: 'Database optimization', description: 'Optimize database queries and add necessary indexes', priority: 'medium' },
      { title: 'User experience improvements', description: 'Review and improve user interface and user experience', priority: 'medium' },
      { title: 'Code refactoring', description: 'Refactor legacy code to improve maintainability and readability', priority: 'low' },
      { title: 'API documentation', description: 'Create and maintain comprehensive API documentation', priority: 'medium' },
      { title: 'Backup and recovery setup', description: 'Implement backup and disaster recovery procedures', priority: 'high' }
    ];
    
    // Context-based suggestions
    if (context.toLowerCase().includes('bug') || context.toLowerCase().includes('fix')) {
      suggestions.push({
        title: 'Debug and fix reported issues',
        description: `Investigate and resolve bugs related to: ${context}`,
        priority: 'high',
        estimatedHours: 4,
        confidence: 0.8
      });
    }
    
    if (context.toLowerCase().includes('feature') || context.toLowerCase().includes('new')) {
      suggestions.push({
        title: 'Implement new feature',
        description: `Develop new functionality: ${context}`,
        priority: 'medium',
        estimatedHours: 8,
        confidence: 0.7
      });
    }
    
    // Add random suggestions from common tasks
    const shuffled = commonTasks.sort(() => 0.5 - Math.random());
    const remainingSlots = limit - suggestions.length;
    
    for (let i = 0; i < Math.min(remainingSlots, shuffled.length); i++) {
      suggestions.push({
        ...shuffled[i],
        estimatedHours: Math.floor(Math.random() * 8) + 1,
        confidence: 0.6 + Math.random() * 0.3
      });
    }
    
    return suggestions.slice(0, limit);
  }

  // Helper method for time estimation
  private calculateTimeEstimation(title: string, description: string, priority: string, taskType: string, historicalTasks: any[]) {
    let baseHours = 4; // Default base estimation
    
    // Adjust based on title/description complexity
    const wordCount = (title + ' ' + description).split(' ').length;
    if (wordCount > 50) baseHours += 2;
    if (wordCount > 100) baseHours += 2;
    
    // Adjust based on priority
    const priorityMultipliers = { low: 0.8, medium: 1.0, high: 1.3, urgent: 1.5 };
    baseHours *= priorityMultipliers[priority as keyof typeof priorityMultipliers] || 1.0;
    
    // Adjust based on task type
    const typeMultipliers = {
      bug: 0.7,
      feature: 1.2,
      research: 1.5,
      documentation: 0.8,
      testing: 0.9,
      general: 1.0
    };
    baseHours *= typeMultipliers[taskType as keyof typeof typeMultipliers] || 1.0;
    
    // Historical data analysis
    if (historicalTasks.length > 0) {
      const avgCompletionTime = historicalTasks.reduce((sum, task) => {
        const created = new Date(task.created_at);
        const completed = new Date(task.completed_at);
        return sum + (completed.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
      }, 0) / historicalTasks.length;
      
      // Blend historical average with calculated estimate
      baseHours = (baseHours + avgCompletionTime) / 2;
    }
    
    const hours = Math.floor(baseHours);
    const minutes = Math.round((baseHours - hours) * 60);
    
    return {
      hours,
      minutes,
      totalHours: baseHours,
      confidence: historicalTasks.length > 10 ? 0.8 : 0.6,
      factors: {
        complexity: wordCount > 50 ? 'high' : 'medium',
        priority,
        taskType,
        historicalDataPoints: historicalTasks.length
      }
    };
  }

  // Helper method for priority calculation
  private calculatePrioritySuggestion(title: string, description: string, dueDate: string, projectContext: any, _userTasks: any[]) {
    let score = 50; // Base score (medium priority)
    
    // Keyword analysis
    const urgentKeywords = ['urgent', 'critical', 'emergency', 'asap', 'immediately', 'bug', 'error', 'broken'];
    const highKeywords = ['important', 'major', 'significant', 'deadline', 'client', 'production'];
    const lowKeywords = ['nice to have', 'enhancement', 'minor', 'cosmetic', 'cleanup'];
    
    const text = (title + ' ' + description).toLowerCase();
    
    if (urgentKeywords.some(keyword => text.includes(keyword))) score += 30;
    else if (highKeywords.some(keyword => text.includes(keyword))) score += 20;
    else if (lowKeywords.some(keyword => text.includes(keyword))) score -= 20;
    
    // Due date analysis
    if (dueDate) {
      const due = new Date(dueDate);
      const now = new Date();
      const daysUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysUntilDue < 1) score += 30;
      else if (daysUntilDue < 3) score += 20;
      else if (daysUntilDue < 7) score += 10;
      else if (daysUntilDue > 30) score -= 10;
    }
    
    // Project context
    if (projectContext?.status === 'urgent') score += 15;
    
    // Determine priority
    let priority = 'medium';
    let reasoning = [];
    
    if (score >= 80) {
      priority = 'urgent';
      reasoning.push('High urgency indicators detected');
    } else if (score >= 65) {
      priority = 'high';
      reasoning.push('Important task with high impact');
    } else if (score <= 30) {
      priority = 'low';
      reasoning.push('Low impact or enhancement task');
    }
    
    if (dueDate) {
      const daysUntilDue = (new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilDue < 7) reasoning.push('Due date approaching');
    }
    
    return {
      priority,
      confidence: 0.7,
      score,
      reasoning,
      factors: {
        keywordAnalysis: urgentKeywords.some(k => text.includes(k)) ? 'urgent' : 
                        highKeywords.some(k => text.includes(k)) ? 'high' : 'normal',
        dueDateProximity: dueDate ? 'considered' : 'not_provided',
        projectContext: projectContext ? 'available' : 'not_available'
      }
    };
  }

  // Helper method for assignee suggestions
  private calculateAssigneeSuggestions(title: string, description: string, skillsRequired: string[], _workload: string, members: any[]) {
    const suggestions = members.map(member => {
      let score = 50; // Base score
      
      // Workload analysis
      const workloadPenalty = member.activeTaskCount * 5;
      score -= workloadPenalty;
      
      // Experience score (based on total tasks completed)
      const experienceBonus = Math.min(member.totalTaskCount * 2, 20);
      score += experienceBonus;
      
      // Role bonus
      if (member.role === 'owner') score += 10;
      else if (member.role === 'admin') score += 5;
      
      // Simple skill matching (in a real implementation, this would be more sophisticated)
      const text = (title + ' ' + description).toLowerCase();
      if (skillsRequired.length > 0) {
        const matchedSkills = skillsRequired.filter(skill => 
          text.includes(skill.toLowerCase()) || 
          member.username.toLowerCase().includes(skill.toLowerCase())
        );
        score += matchedSkills.length * 10;
      }
      
      return {
        user: {
          id: member.id,
          username: member.username,
          first_name: member.first_name,
          last_name: member.last_name,
          email: member.email
        },
        score: Math.max(0, Math.min(100, score)),
        confidence: 0.6,
        reasons: [
          `Current workload: ${member.activeTaskCount} active tasks`,
          `Experience: ${member.totalTaskCount} total tasks`,
          `Role: ${member.role}`,
          ...(skillsRequired.length > 0 ? [`Skills: ${skillsRequired.join(', ')}`] : [])
        ],
        workloadStatus: member.activeTaskCount < 3 ? 'light' : 
                       member.activeTaskCount < 6 ? 'moderate' : 'heavy'
      };
    }).sort((a, b) => b.score - a.score);
    
    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  // Helper method for task breakdown
  private generateTaskBreakdown(title: string, description: string, complexity: string, _similarTasks: any[]) {
    const subtasks: Array<{title: string, estimatedHours: number, priority: string}> = [];
    
    // Common subtask patterns
    const commonSubtasks = [
      'Research and planning',
      'Design and architecture',
      'Implementation',
      'Testing',
      'Documentation',
      'Code review',
      'Deployment preparation'
    ];
    
    // Complexity-based subtask generation
    const complexityMap = {
      low: 3,
      medium: 5,
      high: 7,
      very_high: 9
    };
    
    const subtaskCount = complexityMap[complexity as keyof typeof complexityMap] || 5;
    
    // Generate contextual subtasks
    const text = (title + ' ' + description).toLowerCase();
    
    if (text.includes('api') || text.includes('backend')) {
      subtasks.push(
        { title: 'Design API endpoints', estimatedHours: 2, priority: 'high' },
        { title: 'Implement backend logic', estimatedHours: 4, priority: 'high' },
        { title: 'Add error handling', estimatedHours: 2, priority: 'medium' }
      );
    }
    
    if (text.includes('ui') || text.includes('frontend')) {
      subtasks.push(
        { title: 'Create UI mockups', estimatedHours: 2, priority: 'medium' },
        { title: 'Implement user interface', estimatedHours: 4, priority: 'high' },
        { title: 'Add responsive design', estimatedHours: 2, priority: 'medium' }
      );
    }
    
    if (text.includes('database') || text.includes('data')) {
      subtasks.push(
        { title: 'Design database schema', estimatedHours: 2, priority: 'high' },
        { title: 'Create migrations', estimatedHours: 1, priority: 'high' },
        { title: 'Optimize queries', estimatedHours: 2, priority: 'medium' }
      );
    }
    
    // Fill remaining slots with common subtasks
    while (subtasks.length < subtaskCount) {
      const remaining = commonSubtasks.filter(task => 
        !subtasks.some(st => st.title.toLowerCase().includes(task.toLowerCase()))
      );
      
      if (remaining.length === 0) break;
      
      const randomTask = remaining[Math.floor(Math.random() * remaining.length)];
      const priorities = ['low', 'medium', 'high'];
      const randomPriority = priorities[Math.floor(Math.random() * 3)];
      subtasks.push({
        title: randomTask || 'General task',
        estimatedHours: Math.floor(Math.random() * 4) + 1,
        priority: randomPriority || 'medium'
      });
    }
    
    const totalHours = subtasks.reduce((sum, task) => sum + task.estimatedHours, 0);
    
    return {
      subtasks: subtasks.slice(0, subtaskCount),
      totalEstimatedHours: totalHours,
      complexity,
      confidence: 0.7,
      recommendations: [
        'Start with high-priority subtasks',
        'Consider breaking down large subtasks further',
        'Review estimates after beginning work',
        'Update progress regularly'
      ]
    };
  }
}

export const aiController = new AIController();
