import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/config';

// Extend Request type to include user property for tests
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

// Create a helper function to create and run tests with mock authentication
export const createAuthTest = () => {
  // Create a mock version of the auth middleware for testing
  const mockAuthMiddleware = async (req: AuthRequest, res: Response, next: Function) => {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }
      
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      // Skip database lookup in tests for speed
      req.user = {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username
      };
      
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token.' });
    }
  };

  // Helper to generate test token
  const generateTestToken = (user: { id: string; email: string; username: string }) => {
    return jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  };

  return {
    mockAuthMiddleware,
    generateTestToken
  };
};
