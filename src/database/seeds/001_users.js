const bcrypt = require('bcryptjs');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex('users').del();

  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 10);
  const demoPassword = await bcrypt.hash('demo123', 10);

  // Insert seed entries
  await knex('users').insert([
    {
      username: 'admin',
      email: 'admin@example.com',
      password_hash: adminPassword,
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      is_active: true,
      preferences: JSON.stringify({
        theme: 'light',
        notifications: true,
        timezone: 'UTC'
      })
    },
    {
      username: 'demo',
      email: 'demo@example.com',
      password_hash: demoPassword,
      first_name: 'Demo',
      last_name: 'User',
      role: 'user',
      is_active: true,
      preferences: JSON.stringify({
        theme: 'light',
        notifications: true,
        timezone: 'UTC'
      })
    }
  ]);
};
