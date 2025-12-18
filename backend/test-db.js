const { Pool } = require('pg');

const pool = new Pool({
  host: '212.108.132.92',
  port: 5432,
  user: 'begum',
  password: 'KORDO',
  database: 'react',
  connectionTimeoutMillis: 5000,
});

async function test() {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL bağlantısı başarılı!');
    
    // Mevcut tabloları listele
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('\n📋 Mevcut tablolar:');
    tables.rows.forEach(row => {
      console.log('  -', row.table_name);
    });
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Bağlantı hatası:', error.message);
    process.exit(1);
  }
}

test();
