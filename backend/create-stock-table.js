const { Client } = require('pg');

// Ana veritabanına bağlanıp şube bilgilerini alacağız
const mainClient = new Client({
  connectionString: 'postgresql://frfood_user:OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt@dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com:5432/react?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function createStockTable() {
  try {
    await mainClient.connect();
    console.log('Şubeler alınıyor...');
    
    const branchesRes = await mainClient.query('SELECT * FROM branches');
    const branches = branchesRes.rows;

    for (const branch of branches) {
      console.log(`\n--- Şube: ${branch.name} (${branch.db_host}) ---`);
      
      const branchClient = new Client({
        host: branch.db_host,
        user: branch.db_user,
        password: branch.db_password,
        database: branch.db_name,
        port: branch.db_port,
        // SSL yok (şubeler için kapatmıştık)
      });

      try {
        await branchClient.connect();
        
        // Tabloyu oluştur
        await branchClient.query(`
          CREATE TABLE IF NOT EXISTS daily_stock (
            id SERIAL PRIMARY KEY,
            product_name VARCHAR(255) NOT NULL,
            quantity INTEGER DEFAULT 0,
            entry_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(product_name, entry_date)
          );
        `);
        console.log('✅ daily_stock tablosu oluşturuldu/kontrol edildi.');
        
        await branchClient.end();
      } catch (err) {
        console.error(`❌ Şube Hatası (${branch.name}):`, err.message);
      }
    }

  } catch (err) {
    console.error('Ana Hata:', err);
  } finally {
    await mainClient.end();
  }
}

createStockTable();