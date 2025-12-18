const { Pool } = require('pg');

const pool = new Pool({
  host: '212.108.132.92',
  port: 5432,
  user: 'begum',
  password: 'KORDO',
  database: 'react',
});

async function checkUser() {
  try {
    // Test kullanıcısını kontrol et
    const userQuery = `
      SELECT u.id, u.email, u.selected_branch,
             (SELECT json_agg(b.*) FROM branches b WHERE b.user_id = u.id) as branches
      FROM users u
      WHERE u.email = 'test@example.com'
    `;
    
    const result = await pool.query(userQuery);
    console.log('👤 Test Kullanıcısı:');
    console.log(JSON.stringify(result.rows[0], null, 2));
    
    // Tüm branch'leri listele
    const branchesQuery = `SELECT * FROM branches`;
    const branchesResult = await pool.query(branchesQuery);
    console.log('\n🏢 Tüm Branch\'ler:');
    console.log(JSON.stringify(branchesResult.rows, null, 2));
    
    await pool.end();
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}

checkUser();
