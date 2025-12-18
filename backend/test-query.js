const { Pool } = require('pg');

const pool = new Pool({
  host: '212.108.132.92',
  port: 5432,
  user: 'begum',
  password: 'KORDO',
  database: 'react',
});

async function test() {
  try {
    const adsno = '296424';
    const kasa_nos = [1]; // Test için
    
    // Önce ads_acik tablosunda bu adisyon var mı kontrol edelim
    const checkQuery = `
      SELECT adsno, adtur, masano, actar, acsaat, garsonno, sipyer, pluid, miktar, bfiyat, tutar, ack1, ack2, ack3, sturu, iskonto
      FROM ads_acik 
      WHERE adsno = $1
      LIMIT 5
    `;
    
    console.log('🔍 ads_acik tablosunda adisyon kontrolü:');
    const checkResult = await pool.query(checkQuery, [adsno]);
    console.log('Bulunan kayıt sayısı:', checkResult.rows.length);
    console.log('İlk kayıt:', JSON.stringify(checkResult.rows[0], null, 2));
    
    if (checkResult.rows.length === 0) {
      console.log('\n❌ Bu adisyon ads_acik tablosunda bulunamadı!');
      
      // Hangi kasa_no'lar var bakalım
      const kasaQuery = `SELECT DISTINCT kasa FROM ads_acik WHERE adsno = $1`;
      const kasaResult = await pool.query(kasaQuery, [adsno]);
      console.log('Adisyonun kasa_no değerleri:', kasaResult.rows);
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}

test();
