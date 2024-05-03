exports.up = function(knex) {
    return knex.schema.createTable('regions', table => {
        table.increments('id');
        table.string('name').notNullable().unique();
        table.string('code').notNullable();
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('regions');
};