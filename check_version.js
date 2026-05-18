
const { Client } = require('pg');

const config = {
    connectionString: 'postgresql://cgibridge:j^N&%d&kZUAJ1x0BVpwZ@pgsql01.agnat.pl:5432/cgibridge?sslmode=no-verify',
    ssl: { rejectUnauthorized: false }
};

const client = new Client(config);

async function checkVersion() {
    try {
        await client.connect();
        const res = await client.query('SELECT version()');
        console.log('Postgres Version:', res.rows[0].version);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkVersion();
