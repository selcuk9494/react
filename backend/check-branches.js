const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function checkBranches() {
  try {
    await client.connect();
    
    const res = await client.query('SELECT id, name, db_host, db_user, db_name FROM branches');
    console.log('--- ŞUBE VERİTABANI AYARLARI ---');
    console.table(res.rows);

  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await client.end();
  }
}

checkBranches();