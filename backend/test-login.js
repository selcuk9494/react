const { Client } = require('pg');
const bcrypt = require('bcrypt');

const client = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function testLogin() {
  try {
    console.log('Bağlantı kuruluyor...');
    await client.connect();
    
    const email = 'selcuk.yilmaz@microvise.net';
    const password = '123456';

    console.log(`Kullanıcı aranıyor: ${email}`);
    const res = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    if (res.rows.length === 0) {
      console.log('❌ Kullanıcı bulunamadı!');
      return;
    }

    const user = res.rows[0];
    console.log('✅ Kullanıcı bulundu:', { id: user.id, email: user.email, username: user.username });

    console.log('Şifre kontrol ediliyor...');
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      console.log('✅ Şifre DOĞRU! Giriş başarılı.');
    } else {
      console.log('❌ Şifre YANLIŞ!');
      // Debug: Hash'i göster
      console.log('DB Hash:', user.password);
      const newHash = await bcrypt.hash(password, 10);
      console.log('Test Hash:', newHash);
    }

  } catch (err) {
    console.error('❌ HATA:', err);
  } finally {
    await client.end();
  }
}

testLogin();