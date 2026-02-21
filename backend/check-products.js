
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://begum:KORDO@212.108.132.92:5432/react', // Ana DB
  ssl: false
});

async function checkProducts() {
  const client = await pool.connect();
  try {
    console.log('Checking product table in main DB...');
    
    // Check table existence
    const tableRes = await client.query("SELECT to_regclass('public.product')");
    if (!tableRes.rows[0].to_regclass) {
        console.log('Product table does not exist!');
        return;
    }

    // Check count
    const countRes = await client.query('SELECT COUNT(*) FROM product');
    console.log('Total products:', countRes.rows[0].count);

    // Check sample
    const sampleRes = await client.query('SELECT * FROM product LIMIT 5');
    console.log('Sample products:', sampleRes.rows);
    
    // Check silindi column type and values
    const silindiRes = await client.query('SELECT silindi, COUNT(*) FROM product GROUP BY silindi');
    console.log('Silindi distribution:', silindiRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

checkProducts();
