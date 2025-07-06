/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Check if we need to add the joined_at column
  const hasJoinedAt = await knex.schema.hasColumn('project_members', 'joined_at');
  
  if (!hasJoinedAt) {
    return knex.schema.alterTable('project_members', (table) => {
      table.timestamp('joined_at').defaultTo(knex.fn.now());
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  return knex.schema.alterTable('project_members', (table) => {
    table.dropColumn('joined_at');
  });
};
