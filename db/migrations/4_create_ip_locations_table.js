exports.up = function(knex) {
    return knex.schema.createTable('ip_locations', table => {
        table.increments();
        table.string('ip').notNullable().unique();
        table.integer('city_id').unsigned().references('id').inTable('cities');
        table.integer('region_id').unsigned().references('id').inTable('regions');
        table.integer('country_id').unsigned().references('id').inTable('countries');
        table.integer('count').notNullable().defaultTo(1);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.decimal('latitude', 10, 6);
        table.decimal('longitude', 10, 6);
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('ip_locations');
};