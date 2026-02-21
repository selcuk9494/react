const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function updateDbName() {
  try {
    await client.connect();
    console.log('Şube veritabanı adı güncelleniyor...');
    
    // Tüm şubelerin db_name'ini 'react' yap
    const res = await client.query("UPDATE branches SET db_name = 'react' RETURNING name, db_name");
    
    console.log(`${res.rowCount} adet şube güncellendi.`);
    console.log('Örnek:', res.rows.slice(0, 1));

  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await client.end();
  }
}

updateDbName();