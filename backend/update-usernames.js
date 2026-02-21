const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function updateusernames() {
  try {
    await client.connect();
    console.log('Kullanıcı adları güncelleniyor...');
    
    // Get users with null username
    const res = await client.query('SELECT id, email FROM users WHERE username IS NULL');
    
    for (const user of res.rows) {
      const username = user.email.split('@')[0];
      await client.query('UPDATE users SET username = $1 WHERE id = $2', [username, user.id]);
      console.log(`✅ ${user.email} -> ${username}`);
    }

    // Set selcuk.yilmaz@microvise.net as admin
    await client.query("UPDATE users SET is_admin = TRUE WHERE email = 'selcuk.yilmaz@microvise.net'");
    console.log('✅ Admin yetkisi verildi: selcuk.yilmaz@microvise.net');

    console.log('\n--- İŞLEM TAMAMLANDI ---');

  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await client.end();
  }
}

updateusernames();