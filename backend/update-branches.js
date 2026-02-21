const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function updateBranchHosts() {
  try {
    await client.connect();
    console.log('Şube veritabanı bilgileri güncelleniyor...');
    
    const newHost = 'dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com';
    const newUser = 'frfood_user';
    const newPass = 'OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt';
    // db_name muhtemelen 'react' olmalı eğer tek veritabanı kullanıyorsanız
    // Ama belki her şube için ayrı DB vardır? 
    // Şimdilik sadece HOST, USER ve PASSWORD güncelliyoruz.
    
    const res = await client.query(`
      UPDATE branches 
      SET db_host = $1, 
          db_user = $2, 
          db_password = $3
      RETURNING id, name, db_host
    `, [newHost, newUser, newPass]);
    
    console.log(`${res.rowCount} adet şube güncellendi.`);
    console.log('Örnek:', res.rows.slice(0, 1));

  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await client.end();
  }
}

updateBranchHosts();