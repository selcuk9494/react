const { Pool } = require('pg');

const branchPool = new Pool({
  host: '93.182.78.170',
  port: 5432,
  user: 'begum',
  password: 'KORDO',
  database: 'fastrest',
});

async function test() {
  try {
    const adsno = '296425';
    const kasa_nos = [1];
    
    const query = `
        SELECT
            a.adsno,
            MAX(COALESCE(a.adtur, 0)) as adtur,
            MAX(COALESCE(a.masano, 0)) as masano,
            MAX(COALESCE(a.masano, 0)) as masa_no,
            MAX(CAST(COALESCE(a.sipyer, 0) AS INTEGER)) as sipyer,
            MAX(p.adi) as garson,
            MAX(m.adi) as customer_name,
            MAX(a.mustid) as mustid,
            MAX(a.actar) as tarih,
            MAX(a.acsaat) as acilis_saati,
            NULL as kapanis_saati,
            COALESCE(SUM(a.iskonto), 0) as toplam_iskonto,
            COALESCE(SUM(a.tutar), 0) as toplam_tutar
        FROM ads_acik a
        LEFT JOIN personel p ON a.garsonno = p.id
        LEFT JOIN ads_musteri m ON a.mustid = m.id
        WHERE a.kasa = ANY($1) AND a.adsno = $2
        GROUP BY a.adsno
    `;
    
    console.log('Testing basic query...');
    const result = await branchPool.query(query, [kasa_nos, adsno]);
    console.log('✅ Basic query result:', JSON.stringify(result.rows[0], null, 2));
    
    // Şimdi items'ı ekleyelim
    const queryWithItems = `
        SELECT
            a.adsno,
            MAX(COALESCE(a.adtur, 0)) as adtur,
            MAX(COALESCE(a.masano, 0)) as masano,
            COALESCE(
                json_agg(
                    json_build_object(
                        'product_name', COALESCE(pr.product_name, CAST(a.pluid AS VARCHAR)),
                        'quantity', COALESCE(a.miktar, 1),
                        'price', COALESCE(a.bfiyat, 0),
                        'total', COALESCE(a.tutar, 0),
                        'ack1', a.ack1,
                        'ack2', a.ack2,
                        'ack3', a.ack3,
                        'sturu', COALESCE(a.sturu, 0)
                    )
                    ORDER BY a.actar, a.acsaat
                ),
                '[]'::json
            ) as items
        FROM ads_acik a
        LEFT JOIN product pr ON a.pluid = pr.plu
        WHERE a.kasa = ANY($1) AND a.adsno = $2
        GROUP BY a.adsno
    `;
    
    console.log('\nTesting query with items...');
    const result2 = await branchPool.query(queryWithItems, [kasa_nos, adsno]);
    console.log('✅ Items query result:', JSON.stringify(result2.rows[0], null, 2));
    
    await branchPool.end();
  } catch (error) {
    console.error('❌ SQL Error:', error.message);
    console.error('Detail:', error.detail);
    process.exit(1);
  }
}

test();
