import { createClient } from 'redis';
import { config } from '../config/config';
import { logger } from '../utils/logger';

let redisClient: ReturnType<typeof createClient> | null = null;
let redisAvailable = false;

export const initializeRedis = async (): Promise<void> => {
  try {
    redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        connectTimeout: 5000,
      },
      ...(config.redis.password && { password: config.redis.password }),
    });

    setupRedisHandlers();
    
    await redisClient.connect();
    redisAvailable = true;
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.warn('Redis connection failed, continuing without cache:', error);
    redisAvailable = false;
    redisClient = null;
  }
};

export const connectRedis = async (): Promise<void> => {
  if (!redisAvailable) {
    throw new Error('Redis is not available');
  }
  // Already connected during initialization
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info('Redis connection closed');
    redisAvailable = false;
  }
};

export const getRedisClient = () => {
  if (!redisAvailable || !redisClient) {
    throw new Error('Redis is not available');
  }
  return redisClient;
};

export const isRedisAvailable = (): boolean => {
  return redisAvailable;
};

// Only set up event handlers if we're going to connect
let handlersSet = false;
const setupRedisHandlers = () => {
  if (handlersSet || !redisClient) return;
  
  redisClient.on('error', (error) => {
    logger.error('Redis error:', error);
    redisAvailable = false;
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
    redisAvailable = true;
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  redisClient.on('end', () => {
    logger.info('Redis client connection ended');
    redisAvailable = false;
  });
  
  handlersSet = true;
};
