
const { Client } = require('pg');

const config = {
    connectionString: 'postgresql://cgibridge:j^N&%d&kZUAJ1x0BVpwZ@pgsql01.agnat.pl:5432/cgibridge?sslmode=no-verify',
    ssl: { rejectUnauthorized: false }
};

const client = new Client(config);

async function dropMigrations() {
    try {
        await client.connect();
        console.log('Connected to database.');

        await client.query('DROP TABLE IF EXISTS "_prisma_migrations" CASCADE');
        console.log('Dropped table: _prisma_migrations');

    } catch (err) {
        console.error('Database connection error:', err);
    } finally {
        await client.end();
    }
}

dropMigrations();
