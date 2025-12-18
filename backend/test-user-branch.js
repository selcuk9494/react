const { Pool } = require('pg');

const mainPool = new Pool({
  host: '212.108.132.92',
  port: 5432,
  user: 'begum',
  password: 'KORDO',
  database: 'react',
});

async function test() {
  try {
    // Test kullanıcısının branch'lerini kontrol et
    const userQuery = `
      SELECT u.id, u.email, u.selected_branch,
             b.id as branch_id, b.name as branch_name, b.db_host, b.db_port, b.db_name, b.kasa_no
      FROM users u
      LEFT JOIN branches b ON b.user_id = u.id
      WHERE u.email = 'test@example.com'
    `;
    
    const result = await mainPool.query(userQuery);
    console.log('👤 Test Kullanıcısı ve Branch Bilgileri:');
    result.rows.forEach(row => {
      console.log(JSON.stringify(row, null, 2));
    });
    
    if (result.rows.length > 0 && result.rows[0].branch_id) {
      const branchInfo = result.rows[0];
      console.log('\n🏢 Branch Veritabanına Bağlanıyorum...');
      console.log(`Host: ${branchInfo.db_host}, DB: ${branchInfo.db_name}, Kasa: ${branchInfo.kasa_no}`);
      
      // Branch veritabanına bağlan
      const branchPool = new Pool({
        host: branchInfo.db_host,
        port: branchInfo.db_port,
        user: 'begum',
        password: 'KORDO',
        database: branchInfo.db_name,
      });
      
      // ads_acik tablosunda kayıt var mı kontrol et
      const countQuery = `SELECT COUNT(*) as count FROM ads_acik WHERE kasa = $1`;
      const countResult = await branchPool.query(countQuery, [branchInfo.kasa_no]);
      console.log(`\n📊 Açık adisyon sayısı: ${countResult.rows[0].count}`);
      
      // İlk birkaç kaydı göster
      if (countResult.rows[0].count > 0) {
        const sampleQuery = `
          SELECT adsno, adtur, masano, actar, acsaat, COUNT(*) OVER() as total_items
          FROM ads_acik 
          WHERE kasa = $1
          GROUP BY adsno, adtur, masano, actar, acsaat
          ORDER BY adsno DESC
          LIMIT 3
        `;
        const sampleResult = await branchPool.query(sampleQuery, [branchInfo.kasa_no]);
        console.log('\n📋 Örnek açık adisyonlar:');
        sampleResult.rows.forEach(row => {
          console.log(`  - Adisyon #${row.adsno}, Masa: ${row.masano}, Tarih: ${row.actar}, Items: ${row.total_items}`);
        });
      }
      
      await branchPool.end();
    } else {
      console.log('\n⚠️ Test kullanıcısına henüz branch eklenmemiş!');
    }
    
    await mainPool.end();
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}

test();
