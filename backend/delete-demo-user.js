const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://begum:KORDO@212.108.132.92:5432/react',
  ssl: false
});

async function deleteDemoUser() {
  try {
    await client.connect();
    
    const email = 'demo@micrapor.com';
    const res = await client.query('DELETE FROM users WHERE email = $1 RETURNING id, email', [email]);

    if (res.rows.length > 0) {
      console.log(`✅ Kullanıcı silindi: ${email}`);
    } else {
      console.log(`ℹ️ Kullanıcı zaten yok: ${email}`);
    }

  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await client.end();
  }
}

deleteDemoUser();