const { Client } = require('pg');
const bcrypt = require('bcrypt');

const client = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function resetPassword() {
  try {
    await client.connect();
    
    const email = 'selcuk.yilmaz@microvise.net';
    const newPassword = '123456'; // İsterseniz burayı değiştirebilirsiniz
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const res = await client.query(
      'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email',
      [hashedPassword, email]
    );

    if (res.rows.length > 0) {
      console.log(`✅ Şifre başarıyla güncellendi: ${email}`);
      console.log(`Yeni Şifre: ${newPassword}`);
    } else {
      console.log(`❌ Kullanıcı bulunamadı: ${email}`);
    }

  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await client.end();
  }
}

resetPassword();