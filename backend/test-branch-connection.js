const { Client } = require('pg');

const branchConfig = {
  host: '185.206.71.212',
  user: 'begum',
  password: 'KORDO', // Bu şifreyi veritabanından almadık, varsayım.
  // Gerçek şifreyi veritabanından çekmemiz lazım.
  database: 'fastrest',
  port: 5432,
  // SSL denemesi: Önce SSL ile dene, olmazsa SSL'siz dene
  ssl: { rejectUnauthorized: false } 
};

// Şifreyi react veritabanından çekelim
const mainClient = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function testBranch() {
  try {
    // 1. Şube şifresini al
    await mainClient.connect();
    const res = await mainClient.query("SELECT db_password FROM branches WHERE name = 'Sams Chicken' LIMIT 1");
    if (res.rows.length === 0) {
      console.log('Şube bulunamadı!');
      return;
    }
    const dbPassword = res.rows[0].db_password;
    await mainClient.end();

    console.log(`Şube Şifresi Alındı: ${dbPassword ? '******' : 'YOK'}`);
    branchConfig.password = dbPassword;

    // 2. Şubeye bağlanmayı dene
    console.log(`Şubeye bağlanılıyor (${branchConfig.host})...`);
    
    const branchClient = new Client(branchConfig);
    
    try {
        await branchClient.connect();
        console.log('✅ BAĞLANTI BAŞARILI!');
        
        const tableRes = await branchClient.query("SELECT count(*) FROM ads_adisyon"); // Doğru tablo
        console.log('Adisyon Sayısı:', tableRes.rows[0].count);
        
    } catch (connErr) {
        console.error('❌ Bağlantı Hatası (SSL ile):', connErr.message);
        
        // SSL olmadan dene
        console.log('SSL olmadan tekrar deneniyor...');
        delete branchConfig.ssl;
        const branchClientNoSSL = new Client(branchConfig);
        try {
            await branchClientNoSSL.connect();
            console.log('✅ SSL OLMADAN BAĞLANTI BAŞARILI!');
             const tableRes = await branchClientNoSSL.query("SELECT count(*) FROM ads_adisyon");
            console.log('Adisyon Sayısı:', tableRes.rows[0].count);
            await branchClientNoSSL.end();
        } catch (noSslErr) {
             console.error('❌ Bağlantı Hatası (SSLsiz):', noSslErr.message);
        }
    } finally {
        // branchClient.end() hata verebilir eğer bağlanamadıysa, try-catch içinde değil
    }

  } catch (err) {
    console.error('Genel Hata:', err);
  }
}

testBranch();