
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function addColumn() {
  try {
    await client.connect();
    console.log('Connected to Render DB');
    
    // Check if column exists
    const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'allowed_reports'
    `);
    
    if (res.rows.length === 0) {
        console.log('Adding allowed_reports column...');
        await client.query('ALTER TABLE users ADD COLUMN allowed_reports TEXT[]');
        console.log('✅ Column added successfully!');
    } else {
        console.log('ℹ️ Column already exists.');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.end();
  }
}

addColumn();
