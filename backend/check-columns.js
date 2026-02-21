
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://begum:KORDO@212.108.132.92:5432/react',
  ssl: false
});

async function checkColumns() {
  const client = await pool.connect();
  try {
    console.log('Checking columns in users table...');
    const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
    `);
    
    console.log('Columns:', res.rows.map(r => `${r.column_name} (${r.data_type})`));
    
    const allowedReportsCol = res.rows.find(r => r.column_name === 'allowed_reports');
    if (allowedReportsCol) {
        console.log('✅ allowed_reports column exists!');
    } else {
        console.log('❌ allowed_reports column MISSING!');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

checkColumns();
