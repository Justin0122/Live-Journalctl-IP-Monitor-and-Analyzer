exports.up = function(knex) {
    return knex.schema.createTable('countries', table => {
        table.increments('id');
        table.string('name').notNullable().unique();
        table.string('code').notNullable();
        table.string('code_iso3').notNullable();
        table.string('capital').notNullable();
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('countries');
};