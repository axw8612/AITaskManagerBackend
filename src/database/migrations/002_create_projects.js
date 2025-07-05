/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  return knex.schema.createTable('projects', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.text('description').nullable();
    table.uuid('owner_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('status', ['active', 'completed', 'archived']).defaultTo('active');
    table.json('settings').defaultTo('{}');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['owner_id']);
    table.index(['status']);
    table.index(['name']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  return knex.schema.dropTable('projects');
};
