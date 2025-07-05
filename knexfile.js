module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'vault.wes.lan',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'ai_task_manager',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'r-2cv6VXsX7u',
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './src/database/migrations',
      extension: 'js',
    },
    seeds: {
      directory: './src/database/seeds',
      extension: 'js',
    },
  },

  test: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'vault.wes.lan',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME_TEST || 'ai_task_manager_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'r-2cv6VXsX7u',
    },
    pool: {
      min: 1,
      max: 5,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './src/database/migrations',
      extension: 'js',
    },
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      min: 2,
      max: 20,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './src/database/migrations',
      extension: 'js',
    },
  },
};
