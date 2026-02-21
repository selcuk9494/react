
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://begum:KORDO@212.108.132.92:5432/react',
  ssl: false
});

async function createProducts() {
  const client = await pool.connect();
  try {
    console.log('Creating product table and sample data in main DB (Demo)...');
    
    // Create Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS product (
        id SERIAL PRIMARY KEY,
        product_name VARCHAR(255) NOT NULL,
        grup2 VARCHAR(100),
        silindi INTEGER DEFAULT 0,
        fiyat DECIMAL(10,2) DEFAULT 0
      );
    `);
    
    const products = [
      { name: 'Hamburger', group: 'Ana Yemek', price: 150 },
      { name: 'Cheeseburger', group: 'Ana Yemek', price: 170 },
      { name: 'Pizza Margherita', group: 'Ana Yemek', price: 140 },
      { name: 'Cola', group: 'İçecek', price: 30 },
      { name: 'Fanta', group: 'İçecek', price: 30 },
      { name: 'Su', group: 'İçecek', price: 10 },
      { name: 'Patates Kızartması', group: 'Ara Sıcak', price: 60 },
      { name: 'Soğan Halkası', group: 'Ara Sıcak', price: 50 },
      { name: 'Cheesecake', group: 'Tatlı', price: 90 },
      { name: 'Tiramisu', group: 'Tatlı', price: 100 }
    ];

    // Check count
    const countRes = await client.query('SELECT COUNT(*) FROM product');
    const count = parseInt(countRes.rows[0].count);
    
    if (count === 0) {
        console.log('Inserting products...');
        for (const p of products) {
            await client.query(`
                INSERT INTO product (product_name, grup2, fiyat, silindi)
                VALUES ($1, $2, $3, 0)
            `, [p.name, p.group, p.price]);
        }
        console.log('Inserted 10 demo products.');
    } else {
        console.log(`Table already has ${count} products. Skipping insertion.`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

createProducts();
