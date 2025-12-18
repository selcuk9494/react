const { Pool } = require('pg');
const { format } = require('date-fns');

const pool = new Pool({
  host: '93.182.78.170',
  port: 5432,
  user: 'begum',
  password: 'KORDO',
  database: 'fastrest',
});

async function test() {
  try {
    const kasa_nos = [1];
    const today = new Date();
    const dStart = format(today, 'yyyy-MM-dd');
    const dEnd = format(today, 'yyyy-MM-dd');
    
    console.log(`📅 Tarih aralığı: ${dStart} - ${dEnd}`);
    
    const query = `
      SELECT 
        o.adsno,
        o.raptar as tarih,
        MAX(a.kapsaat) as kapanis_saati,
        MAX(a.acsaat) as acilis_saati,
        MAX(COALESCE(a.masano, 0)) as masano,
        MAX(COALESCE(a.masano, 0)) as masa_no,
        SUM(o.otutar) as tutar,
        SUM(o.iskonto) as iskonto,
        MAX(CONCAT(COALESCE(m.adi, ''), ' ', COALESCE(m.soyadi, ''))) as customer_name,
        MAX(o.mustid) as mustid,
        MAX(p.adi) as garson_adi,
        MAX(od.odmname) as payment_name
      FROM ads_odeme o
      LEFT JOIN ads_adisyon a ON o.adsno = a.adsno AND o.kasa = a.kasa
      LEFT JOIN ads_musteri m ON o.mustid = m.mustid
      LEFT JOIN personel p ON a.garsonno = p.id
      LEFT JOIN ads_odmsekli od ON o.otip = od.odmno
      WHERE o.kasa = ANY($1)
        AND o.raptar BETWEEN $2 AND $3
        AND o.iskonto > 0
      GROUP BY o.adsno, o.raptar
      ORDER BY o.raptar DESC, o.adsno DESC
      LIMIT 5
    `;

    const result = await pool.query(query, [kasa_nos, dStart, dEnd]);
    
    console.log(`\n✅ Query successful! Found ${result.rows.length} rows`);
    console.log('\nÖrnek sonuçlar:');
    result.rows.forEach(row => {
      console.log(JSON.stringify(row, null, 2));
    });
    
    await pool.end();
  } catch (error) {
    console.error('❌ SQL Error:', error.message);
    process.exit(1);
  }
}

test();
