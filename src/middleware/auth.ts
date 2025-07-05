import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { db } from '../database/connection';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'Access denied. No token provided.' });
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    // Verify user still exists and is active
    const user = await db('users')
      .where({ id: decoded.id, is_active: true })
      .first();

    if (!user) {
      res.status(401).json({ error: 'Invalid token. User not found or inactive.' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token.' });
  }
};

export const authorize = (roles: string[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Access denied. Not authenticated.' });
        return;
      }

      // For project-based authorization, check if user has required role
      const projectId = req.params['projectId'];
      if (projectId) {
        const membership = await db('project_members')
          .where({
            projectId,
            userId: req.user.id,
          })
          .first();

        if (!membership || !roles.includes(membership.role)) {
          res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
          return;
        }
      }

      next();
    } catch (error) {
      logger.error('Authorization error:', error);
      res.status(500).json({ error: 'Authorization check failed.' });
    }
  };
};
