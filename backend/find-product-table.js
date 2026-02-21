const { Client } = require('pg');

const branchConfig = {
  host: '185.206.71.212',
  user: 'begum',
  password: 'KORDO',
  database: 'fastrest',
  port: 5432,
  // SSL yok
};

const mainClient = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function findProductTable() {
  try {
    await mainClient.connect();
    const res = await mainClient.query("SELECT db_password FROM branches WHERE name = 'Sams Chicken' LIMIT 1");
    branchConfig.password = res.rows[0].db_password;
    await mainClient.end();

    const client = new Client(branchConfig);
    await client.connect();
    
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%urun%' OR table_name ILIKE '%plu%')");
    
    console.log('--- Ürün Tabloları ---');
    console.log(tables.rows.map(r => r.table_name).join(', '));
    
    await client.end();

  } catch (err) {
    console.error('Hata:', err);
  }
}

findProductTable();