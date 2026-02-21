
const { Pool } = require('pg');

const pool = new Pool({
  host: 'dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com',
  port: 5432,
  user: 'frfood_user',
  password: 'OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt',
  database: 'react',
  ssl: { rejectUnauthorized: false }
});

async function testEntryStock() {
  const client = await pool.connect();
  try {
    console.log('Testing Stock Entry in RENDER DB...');
    
    const productName = 'Hamburger';
    const quantity = 50;
    const date = new Date().toISOString().split('T')[0];
    
    console.log(`Inserting: ${productName}, ${quantity}, ${date}`);

    await client.query('BEGIN');
    
    // Check if table exists
    const tableRes = await client.query("SELECT to_regclass('public.daily_stock')");
    if (!tableRes.rows[0].to_regclass) {
        console.error('❌ Table daily_stock DOES NOT EXIST!');
        await client.query('ROLLBACK');
        return;
    }

    // Try Insert
    await client.query(`
      INSERT INTO daily_stock (product_name, quantity, entry_date)
      VALUES ($1, $2, $3)
      ON CONFLICT (product_name, entry_date) 
      DO UPDATE SET quantity = $2, updated_at = CURRENT_TIMESTAMP
    `, [productName, quantity, date]);

    await client.query('COMMIT');
    console.log('✅ Insert successful!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Insert Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

testEntryStock();
