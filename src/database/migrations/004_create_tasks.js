/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  return knex.schema.createTable('tasks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title').notNullable();
    table.text('description').nullable();
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('assignee_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.uuid('creator_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('status', ['todo', 'in_progress', 'done', 'cancelled']).defaultTo('todo');
    table.enum('priority', ['low', 'medium', 'high', 'urgent']).defaultTo('medium');
    table.timestamp('due_date').nullable();
    table.integer('estimated_hours').nullable();
    table.integer('actual_hours').nullable();
    table.json('tags').defaultTo('[]');
    table.json('metadata').defaultTo('{}');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['project_id']);
    table.index(['assignee_id']);
    table.index(['creator_id']);
    table.index(['status']);
    table.index(['priority']);
    table.index(['due_date']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  return knex.schema.dropTable('tasks');
};
