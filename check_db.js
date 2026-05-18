const { Client } = require('pg');

const config = {
    connectionString: 'postgresql://cgibridge:j^N&%d&kZUAJ1x0BVpwZ@pgsql01.agnat.pl:5432/chatdb',
    ssl: { rejectUnauthorized: false }
};

async function check() {
    let client = new Client(config);
    try {
        await client.connect();
        console.log('Connected to "chatdb" successfully!');
        const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
        console.log('Existing tables:', tables.rows.map(r => r.tablename));
        await client.end();
    } catch (err) {
        console.error('Connection error to chatdb:', err.message);
        await client.end(); // close failed connection

        if (err.message.includes('database "chatdb" does not exist')) {
            console.log('Trying to connect to "cgibridge" database instead...');
            // Create new client for fallback
            const newConnString = config.connectionString.replace('chatdb', 'cgibridge');
            const client2 = new Client({ ...config, connectionString: newConnString });

            try {
                await client2.connect();
                console.log('Connected to "cgibridge" successfully!');

                const versionRes = await client2.query('SELECT version()');
                console.log('PostgreSQL Version:', versionRes.rows[0].version);

                const tablesRes = await client2.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
                console.log('Existing tables in cgibridge:', tablesRes.rows.map(r => r.tablename));

                await client2.end();
            } catch (e2) {
                console.error('Connection error to "cgibridge":', e2.message);
                await client2.end();
            }
        }
    }
}

check();
