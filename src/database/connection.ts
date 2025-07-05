import knex from 'knex';
import { config } from '../config/config';
import { logger } from '../utils/logger';

const knexConfig = {
  client: 'pg',
  connection: {
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
  },
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: './migrations',
  },
  seeds: {
    directory: './seeds',
  },
};

export const db = knex(knexConfig);

export const connectDatabase = async (): Promise<void> => {
  try {
    await db.raw('SELECT 1');
    logger.info('Database connection successful');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  await db.destroy();
  logger.info('Database connection closed');
};
