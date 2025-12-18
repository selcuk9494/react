const { Pool } = require('pg');

const pool = new Pool({
  host: '93.182.78.170',
  port: 5432,
  user: 'begum',
  password: 'KORDO',
  database: 'fastrest',
});

async function checkSchema() {
  try {
    // ads_musteri tablosunun kolonlarını kontrol et
    const query = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ads_musteri' 
      ORDER BY ordinal_position
    `;
    
    const result = await pool.query(query);
    console.log('ads_musteri table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
