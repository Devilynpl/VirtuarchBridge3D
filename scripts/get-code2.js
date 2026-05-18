const { Client } = require('pg');
const connectionString = 'postgresql://cgibridge:j^N&%d&kZUAJ1x0BVpwZ@pgsql01.agnat.pl:5432/cgibridge?schema=public&sslmode=no-verify';
const client = new Client({
    connectionString: connectionString,
});
client.connect().then(() => {
    return client.query("SELECT username, email, verification_code, is_verified FROM users WHERE email = 'rakpawel1986@yahoo.com'");
}).then((res) => {
    console.log('User Record:');
    console.table(res.rows);
    client.end();
}).catch((err) => {
    console.error(err);
    client.end();
});
