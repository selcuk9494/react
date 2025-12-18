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
    // Önce kapalı adisyon var mı kontrol edelim
    const checkQuery = `
      SELECT adsno, adtur, masano, COUNT(*) as item_count
      FROM ads_adisyon
      WHERE kasa = 1
      GROUP BY adsno, adtur, masano
      ORDER BY adsno DESC
      LIMIT 5
    `;
    
    const checkResult = await pool.query(checkQuery);
    console.log('Son 5 kapalı adisyon:');
    checkResult.rows.forEach(row => {
      console.log(`  - Adisyon #${row.adsno}, Masa: ${row.masano}, Adtur: ${row.adtur}, Items: ${row.item_count}`);
    });
    
    if (checkResult.rows.length > 0) {
      const testAdsno = checkResult.rows[0].adsno;
      console.log(`\nTest ediliyor: Adisyon #${testAdsno}`);
      
      const query = `
          WITH order_info AS (
              SELECT 
                  adsno,
                  MAX(COALESCE(adtur, 0)) as adtur,
                  MAX(COALESCE(masano, 0)) as masano,
                  MAX(CAST(COALESCE(sipyer, 0) AS INTEGER)) as sipyer,
                  MAX(garsonno) as garsonno,
                  MAX(mustid) as mustid,
                  MAX(acsaat) as acilis_saati,
                  MAX(kapsaat) as kapanis_saati
              FROM ads_adisyon
              WHERE kasa = ANY($1) AND adsno = $2
              GROUP BY adsno
          ),
          order_items AS (
              SELECT 
                  a.adsno,
                  json_agg(
                      json_build_object(
                          'product_name', COALESCE(pr.product_name, CAST(a.pluid AS VARCHAR)),
                          'quantity', COALESCE(a.miktar, 1),
                          'price', COALESCE(a.bfiyat, 0),
                          'total', COALESCE(a.tutar, 0),
                          'ack1', a.ack1,
                          'sturu', COALESCE(a.sturu, 0)
                      )
                  ) as items
              FROM ads_adisyon a
              LEFT JOIN product pr ON a.pluid = pr.plu
              WHERE a.kasa = ANY($1) AND a.adsno = $2 AND a.pluid IS NOT NULL
              GROUP BY a.adsno
          ),
          payment_info AS (
              SELECT
                  adsno,
                  MAX(raptar) as tarih,
                  COALESCE(SUM(iskonto), 0) as toplam_iskonto,
                  COALESCE(SUM(otutar), 0) as toplam_tutar
              FROM ads_odeme
              WHERE kasa = ANY($1) AND adsno = $2
              GROUP BY adsno
          )
          SELECT
              oi.adsno,
              oi.adtur,
              oi.masano,
              oi.sipyer,
              p.adi as garson,
              m.adi as customer_name,
              oi.mustid,
              pi.tarih,
              oi.acilis_saati,
              oi.kapanis_saati,
              pi.toplam_iskonto,
              pi.toplam_tutar,
              COALESCE(items.items, '[]'::json) as items
          FROM order_info oi
          LEFT JOIN personel p ON oi.garsonno = p.id
          LEFT JOIN ads_musteri m ON oi.mustid = m.mustid
          LEFT JOIN payment_info pi ON pi.adsno = oi.adsno
          LEFT JOIN order_items items ON items.adsno = oi.adsno
      `;
      
      const result = await pool.query(query, [[1], testAdsno]);
      console.log('✅ Query successful!');
      console.log('Result:', JSON.stringify(result.rows[0], null, 2));
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();
