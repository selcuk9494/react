const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    console.log('Bağlantı başlatılıyor...');
    await client.connect();
    console.log('Bağlantı başarılı! ✅');
    
    const res = await client.query('SELECT NOW()');
    console.log('Sunucu Zamanı:', res.rows[0].now);
    
    const tableRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log('Mevcut Tablolar:', tableRes.rows.map(r => r.table_name));

  } catch (err) {
    console.error('Bağlantı hatası! ❌', err);
  } finally {
    await client.end();
  }
}

testConnection();