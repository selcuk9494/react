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
    const adsno = '296425';
    const kasa_nos = [1];
    
    const query = `
        WITH order_info AS (
            SELECT 
                adsno,
                MAX(COALESCE(adtur, 0)) as adtur,
                MAX(COALESCE(masano, 0)) as masano,
                MAX(CAST(COALESCE(sipyer, 0) AS INTEGER)) as sipyer,
                MAX(garsonno) as garsonno,
                MAX(mustid) as mustid,
                MAX(actar) as tarih,
                MAX(acsaat) as acilis_saati,
                COALESCE(SUM(iskonto), 0) as toplam_iskonto,
                COALESCE(SUM(tutar), 0) as toplam_tutar
            FROM ads_acik
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
            FROM ads_acik a
            LEFT JOIN product pr ON a.pluid = pr.plu
            WHERE a.kasa = ANY($1) AND a.adsno = $2 AND a.pluid IS NOT NULL
            GROUP BY a.adsno
        )
        SELECT
            oi.adsno,
            oi.adtur,
            oi.masano,
            oi.sipyer,
            p.adi as garson,
            m.adi as customer_name,
            oi.mustid,
            oi.tarih,
            oi.acilis_saati,
            oi.toplam_iskonto,
            oi.toplam_tutar,
            COALESCE(items.items, '[]'::json) as items
        FROM order_info oi
        LEFT JOIN personel p ON oi.garsonno = p.id
        LEFT JOIN ads_musteri m ON oi.mustid = m.mustid
        LEFT JOIN order_items items ON items.adsno = oi.adsno
    `;
    
    console.log('Testing new query...');
    const result = await pool.query(query, [kasa_nos, adsno]);
    console.log('✅ Query successful!');
    console.log('Result:', JSON.stringify(result.rows[0], null, 2));
    
    await pool.end();
  } catch (error) {
    console.error('❌ SQL Error:', error.message);
    process.exit(1);
  }
}

test();
