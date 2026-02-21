
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function createStockTables() {
  const client = await pool.connect();
  try {
    console.log('Creating stock tables in RENDER DB...');
    
    // daily_stock
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_stock (
        id SERIAL PRIMARY KEY,
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER DEFAULT 0,
        entry_date DATE NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(product_name, entry_date)
      );
    `);
    console.log('✅ daily_stock table created.');

    // ads_adisyon (Sales)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ads_adisyon (
        id SERIAL PRIMARY KEY,
        pluid INTEGER,
        product_name VARCHAR(255),
        miktar INTEGER,
        tarih DATE,
        sturu INTEGER DEFAULT 0
      );
    `);
    console.log('✅ ads_adisyon table created.');

    // ads_acik (Open Tables)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ads_acik (
        id SERIAL PRIMARY KEY,
        pluid INTEGER,
        product_name VARCHAR(255),
        miktar INTEGER,
        tarih DATE,
        sturu INTEGER DEFAULT 0
      );
    `);
    console.log('✅ ads_acik table created.');
    
    // Insert some sample sales for testing live stock
    // Need product IDs first
    const productRes = await client.query("SELECT id, product_name FROM product LIMIT 5");
    if (productRes.rows.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        
        // Insert sales for today
        for (const p of productRes.rows) {
            // Random sales
            const qty = Math.floor(Math.random() * 5) + 1;
            await client.query(`
                INSERT INTO ads_adisyon (pluid, product_name, miktar, tarih, sturu)
                VALUES ($1, $2, $3, $4, 0)
            `, [p.id, p.product_name, qty, today]);
        }
        console.log('✅ Sample sales inserted.');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

createStockTables();
