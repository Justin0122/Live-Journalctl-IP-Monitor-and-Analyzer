exports.up = function(knex) {
    return knex.schema.createTable('cities', table => {
        table.increments('id');
        table.string('name').notNullable().unique()
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('cities');
};