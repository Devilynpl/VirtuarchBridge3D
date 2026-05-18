const { Client } = require('pg');

const config = {
    connectionString: 'postgresql://cgibridge:j^N&%d&kZUAJ1x0BVpwZ@pgsql01.agnat.pl:5432/cgibridge?sslmode=no-verify',
    ssl: { rejectUnauthorized: false }
};

const client = new Client(config);

async function dropTables() {
    try {
        await client.connect();
        console.log('Connected to database.');

        // Disable constraints temporarily or just drop in order
        // Cascade drop is easiest
        const tables = [
            'conversation_members', 'ConversationMember',
            'asset_requests', 'AssetRequest',
            'channel_invites', 'ChannelInvite',
            'user_blocks', 'UserBlock',
            'attachments', 'Attachment',
            'messages', 'Message',
            'conversations', 'Conversation',
            'users', 'User'
        ];

        for (const table of tables) {
            try {
                // Check if table exists first prevents error but DROP IF EXISTS is better
                await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
                console.log(`Dropped table: ${table}`);
            } catch (err) {
                console.error(`Error dropping ${table}:`, err.message);
            }
        }

        const res = await client.query('SELECT tablename FROM pg_tables WHERE schemaname = \'public\'');
        console.log('Remaining tables in cgibridge:', res.rows.map(row => row.tablename));

        console.log('All specified tables dropped.');
    } catch (err) {
        console.error('Database connection error:', err);
    } finally {
        await client.end();
    }
}

dropTables();
