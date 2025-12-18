const { Pool } = require('pg');

const pool = new Pool({
  host: '212.108.132.92',
  port: 5432,
  user: 'begum',
  password: 'KORDO',
  database: 'react',
});

async function findTables() {
  try {
    // Tüm tabloları listele
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    const result = await pool.query(tablesQuery);
    console.log('📋 Mevcut tablolar:');
    result.rows.forEach(row => {
      console.log('  -', row.table_name);
    });
    
    // ads ile başlayan tabloları ara
    console.log('\n🔍 "ads" ile başlayan tablolar:');
    const adsResult = result.rows.filter(r => r.table_name.toLowerCase().includes('ads'));
    adsResult.forEach(row => {
      console.log('  -', row.table_name);
    });
    
    await pool.end();
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}

findTables();
