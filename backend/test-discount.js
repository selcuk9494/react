const { Pool } = require('pg');

const pool = new Pool({
  host: '93.182.78.170',
  port: 5432,
  user: 'begum',
  password: 'KORDO',
  database: 'fastrest',
});

async function test() {
  try {
    // Önce iskonto yapılmış adisyon var mı kontrol edelim
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM ads_odeme
      WHERE kasa = 1 AND iskonto > 0
    `;
    
    const checkResult = await pool.query(checkQuery);
    console.log(`📊 İskonto yapılmış adisyon sayısı: ${checkResult.rows[0].count}`);
    
    if (checkResult.rows[0].count > 0) {
      // Birkaç örnek göster
      const sampleQuery = `
        SELECT 
          o.adsno,
          o.raptar as tarih,
          SUM(o.otutar) as tutar,
          SUM(o.iskonto) as iskonto
        FROM ads_odeme o
        WHERE o.kasa = 1 AND o.iskonto > 0
        GROUP BY o.adsno, o.raptar
        ORDER BY o.raptar DESC
        LIMIT 5
      `;
      
      const sampleResult = await pool.query(sampleQuery);
      console.log('\n📋 Örnek iskonto yapılmış adisyonlar:');
      sampleResult.rows.forEach(row => {
        console.log(`  - Adisyon #${row.adsno}: Tutar=${row.tutar}, İskonto=${row.iskonto}, Tarih=${row.tarih}`);
      });
    } else {
      console.log('\n⚠️ İskonto yapılmış adisyon bulunamadı!');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();
