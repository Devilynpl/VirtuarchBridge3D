const { Client } = require('pg');
const connectionString = 'postgresql://cgibridge:j^N&%d&kZUAJ1x0BVpwZ@pgsql01.agnat.pl:5432/cgibridge?schema=public&sslmode=no-verify';
const client = new Client({
    connectionString: connectionString,
});
client.connect().then(() => {
    return client.query('SELECT username, email, verification_code, is_verified FROM users ORDER BY created_at DESC LIMIT 5');
}).then((res) => {
    console.log('Recent Verification Codes:');
    console.table(res.rows);
    client.end();
}).catch((err) => {
    console.error(err);
    client.end();
});
