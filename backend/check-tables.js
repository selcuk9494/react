const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function checkTables() {
  try {
    await client.connect();
    
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    
    console.log('--- react VERİTABANINDAKİ TABLOLAR ---');
    console.log(res.rows.map(r => r.table_name).join(', '));

  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await client.end();
  }
}

checkTables();