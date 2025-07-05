// Global test setup
import { config } from '../config/config';

// Set test environment
process.env['NODE_ENV'] = 'test';

// Mock console methods in test environment
if (config.nodeEnv === 'test') {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}
