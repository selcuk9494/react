const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function fixEmails() {
  try {
    await client.connect();
    console.log('E-posta adresleri temizleniyor...');
    
    // Trim and lowercase all emails
    const res = await client.query('UPDATE users SET email = TRIM(LOWER(email)) RETURNING email');
    
    console.log(`${res.rowCount} adet e-posta güncellendi.`);
    console.log('Örnekler:', res.rows.slice(0, 3));

  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await client.end();
  }
}

fixEmails();