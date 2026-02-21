const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function fixSchema() {
  try {
    await client.connect();
    console.log('Şema düzeltiliyor...');
    
    // Add username column
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255)');
    console.log('✅ username sütunu eklendi.');

    // Add other potential missing columns from database.service.ts logic
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE');
    console.log('✅ is_admin sütunu eklendi.');
    
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP');
    console.log('✅ expiry_date sütunu eklendi.');

    // Check again
    const res = await client.query('SELECT id, email, username, is_admin FROM users LIMIT 5');
    console.log('\n--- GÜNCEL KULLANICILAR ---');
    console.table(res.rows);

  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await client.end();
  }
}

fixSchema();