import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

const createProjectSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(2000).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  budget: Joi.number().min(0).optional(),
  color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
});

const updateProjectSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(2000).optional(),
  status: Joi.string().valid('planning', 'active', 'on_hold', 'completed', 'cancelled').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  budget: Joi.number().min(0).optional(),
  color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
});

const addMemberSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  role: Joi.string().valid('owner', 'admin', 'member', 'viewer').required(),
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

export const validateProject = {
  create: validateRequest(createProjectSchema),
  update: validateRequest(updateProjectSchema),
  addMember: validateRequest(addMemberSchema),
};
