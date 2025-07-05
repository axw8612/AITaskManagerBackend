/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  return knex.schema.createTable('ai_suggestions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('task_id').nullable().references('id').inTable('tasks').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('suggestion_type', ['task_breakdown', 'time_estimate', 'priority', 'assignee']).notNullable();
    table.json('suggestion_data').notNullable();
    table.json('context').defaultTo('{}');
    table.boolean('is_applied').defaultTo(false);
    table.text('feedback').nullable();
    table.timestamps(true, true);
    
    // Indexes
    table.index(['task_id']);
    table.index(['user_id']);
    table.index(['suggestion_type']);
    table.index(['is_applied']);
    table.index(['created_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  return knex.schema.dropTable('ai_suggestions');
};
