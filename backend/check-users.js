const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function checkUsers() {
  try {
    await client.connect();
    
    // Check Users
    const res = await client.query('SELECT id, email, username, is_admin, created_at FROM users');
    console.log('--- KULLANICILAR ---');
    if (res.rows.length === 0) {
      console.log('Kayıtlı kullanıcı bulunamadı! ❌');
    } else {
      console.table(res.rows);
    }

    // Check Branches
    const branches = await client.query('SELECT id, name, user_id, db_host FROM branches');
    console.log('\n--- ŞUBELER ---');
    console.table(branches.rows);

  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await client.end();
  }
}

checkUsers();