exports.up = function(knex) {
  return knex.schema.createTable('commands', function(table) {
    table.increments();
    table.string('command').notNullable();
    table.integer('ip_id').unsigned().notNullable();
    table.foreign('ip_id').references('id').inTable('ip_locations');
    table.integer('count').unsigned().defaultTo(1);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('commands');
};