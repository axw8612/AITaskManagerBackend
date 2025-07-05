import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

const updateUserSchema = Joi.object({
  first_name: Joi.string().min(1).max(50).optional(),
  last_name: Joi.string().min(1).max(50).optional(),
  preferences: Joi.object().optional(),
  current_password: Joi.string().min(6).optional(),
  new_password: Joi.string().min(6).optional(),
}).with('new_password', 'current_password');

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

export const validateUser = {
  update: validateRequest(updateUserSchema),
};
