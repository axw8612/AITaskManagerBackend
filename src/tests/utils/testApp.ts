import express from 'express';
import { config } from '../../config/config';
import { errorHandler } from '../../middleware/errorHandler';
import { createAuthTest } from './authTestHelpers';

// Create a custom Express app for testing
export const createTestApp = () => {
  const app = express();
  const { mockAuthMiddleware } = createAuthTest();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Simple health endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'OK' });
  });
  
  // Create a test endpoint with auth
  app.get('/api/test/auth', mockAuthMiddleware, (req: any, res) => {
    res.status(200).json({ 
      success: true, 
      user: req.user 
    });
  });
  
  // Create a test endpoint without auth
  app.get('/api/test/public', (_req, res) => {
    res.status(200).json({ success: true, message: 'Public endpoint' });
  });
  
  // Error handler
  app.use(errorHandler);
  
  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Route not found',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    });
  });
  
  return app;
};
