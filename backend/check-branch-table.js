
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://begum:KORDO@212.108.132.92:5432/react',
  ssl: false
});

async function checkBranchTable() {
  const client = await pool.connect();
  try {
    console.log('Checking columns in branches table...');
    const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'branches'
    `);
    
    console.log('Columns:', res.rows.map(r => `${r.column_name} (${r.data_type})`));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

checkBranchTable();
