/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('users', 'bio');
  if (!hasColumn) {
    return knex.schema.alterTable('users', (table) => {
      table.text('bio').nullable();
    });
  }
  return Promise.resolve();
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('users', 'bio');
  if (hasColumn) {
    return knex.schema.alterTable('users', (table) => {
      table.dropColumn('bio');
    });
  }
  return Promise.resolve();
};
