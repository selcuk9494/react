const { Pool } = require('pg');

const pool = new Pool({
  host: '93.182.78.170',
  port: 5432,
  user: 'begum',
  password: 'KORDO',
  database: 'fastrest',
});

async function check() {
  try {
    // En son açık adisyonları listele
    const query = `
      SELECT adsno, adtur, masano, COUNT(*) as item_count
      FROM ads_acik
      WHERE kasa = 1
      GROUP BY adsno, adtur, masano
      ORDER BY adsno DESC
      LIMIT 5
    `;
    
    const result = await pool.query(query);
    console.log('Son 5 açık adisyon:');
    result.rows.forEach(row => {
      console.log(`  - Adisyon #${row.adsno}, Masa: ${row.masano}, Adtur: ${row.adtur}, Items: ${row.item_count}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

check();
