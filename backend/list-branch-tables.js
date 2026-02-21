const { Client } = require('pg');

const branchConfig = {
  host: '185.206.71.212',
  user: 'begum',
  password: 'KORDO', // Şifre veritabanından alınacak
  database: 'fastrest',
  port: 5432,
  // SSL yok
};

const mainClient = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function listBranchTables() {
  try {
    // 1. Şifreyi al
    await mainClient.connect();
    const res = await mainClient.query("SELECT db_password FROM branches WHERE name = 'Sams Chicken' LIMIT 1");
    branchConfig.password = res.rows[0].db_password;
    await mainClient.end();

    // 2. Şubeye bağlan (SSL'siz)
    const client = new Client(branchConfig);
    await client.connect();
    console.log('✅ Şubeye bağlanıldı!');
    
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    
    console.log('--- ŞUBEDEKİ TABLOLAR ---');
    console.log(tables.rows.map(r => r.table_name).join(', '));
    
    await client.end();

  } catch (err) {
    console.error('Hata:', err);
  }
}

listBranchTables();