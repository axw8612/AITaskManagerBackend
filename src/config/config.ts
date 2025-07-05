import dotenv from 'dotenv';

dotenv.config();

interface Config {
  nodeEnv: string;
  port: number;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  redis: {
    host: string;
    port: number;
    password: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  upload: {
    maxFileSize: number;
    uploadDir: string;
  };
  logging: {
    level: string;
    file: string;
    seq?: {
      serverUrl: string;
      apiKey: string;
    };
  };
  cors: {
    origin: string;
  };
}

export const config: Config = {
  nodeEnv: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['PORT'] || '3000', 10),
  database: {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    name: process.env['DB_NAME'] || 'ai_task_manager',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
  },
  redis: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'] || '',
  },
  jwt: {
    secret: process.env['JWT_SECRET'] || 'fallback-secret-key',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '7d',
  },
  openai: {
    apiKey: process.env['OPENAI_API_KEY'] || '',
    model: process.env['OPENAI_MODEL'] || 'gpt-4',
  },
  rateLimit: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10),
    maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
  },
  upload: {
    maxFileSize: parseInt(process.env['MAX_FILE_SIZE'] || '5242880', 10),
    uploadDir: process.env['UPLOAD_DIR'] || 'uploads',
  },
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
    file: process.env['LOG_FILE'] || 'logs/app.log',
    ...(process.env['SEQ_SERVER_URL'] && {
      seq: {
        serverUrl: process.env['SEQ_SERVER_URL'],
        apiKey: process.env['SEQ_API_KEY'] || '',
      },
    }),
  },
  cors: {
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
  },
};
