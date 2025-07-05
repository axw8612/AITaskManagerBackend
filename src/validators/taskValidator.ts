import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

const createTaskSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(2000).optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').required(),
  assigneeId: Joi.string().uuid().optional(),
  projectId: Joi.string().uuid().optional(),
  dueDate: Joi.date().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  estimatedHours: Joi.number().min(0).optional(),
});

const updateTaskSchema = Joi.object({
  title: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(2000).optional(),
  status: Joi.string().valid('todo', 'in_progress', 'in_review', 'done', 'cancelled').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  assigneeId: Joi.string().uuid().optional(),
  dueDate: Joi.date().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  estimatedHours: Joi.number().min(0).optional(),
  actualHours: Joi.number().min(0).optional(),
});

const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message),
      });
      return;
    }
    next();
  };
};

export const validateTask = {
  create: validateRequest(createTaskSchema),
  update: validateRequest(updateTaskSchema),
};
