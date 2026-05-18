const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = 'postgresql://cgibridge:j^N&%d&kZUAJ1x0BVpwZ@pgsql01.agnat.pl:5432/cgibridge?schema=public&sslmode=no-verify';
const client = new Client({
    connectionString: connectionString,
});
client.connect()
    .then(() => {
        return client.query("UPDATE users SET is_verified = true, status = 'online' WHERE email = 'rakpawel1986@yahoo.com' RETURNING *");
    })
    .then((res) => {
        console.log('User Verified and Online:');
        console.table(res.rows);
        return client.query("UPDATE users SET password_hash = '" + bcrypt.hashSync('password123', 10) + "' WHERE email = 'rakpawel1986@yahoo.com' RETURNING *");
    })
    .then((res) => {
        console.log('Password Reset to password123');
        client.end();
    })
    .catch((err) => {
        console.error(err);
        client.end();
    });
