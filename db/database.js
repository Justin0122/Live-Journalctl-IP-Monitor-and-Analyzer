const knex = require('knex');

const db = knex({
    client: 'mysql',
    connection: {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'vibify',
        timezone: 'Europe/Amsterdam'
    }
});

module.exports = db;