const { Pool } = require('pg');

const pool = new Pool({
  host: '212.108.132.92',
  port: 5432,
  user: 'begum',
  password: 'KORDO',
  database: 'react',
});

async function addExpiryDate() {
  try {
    // Check if column exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='expiry_date'
    `;
    
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      console.log('Adding expiry_date column...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN expiry_date TIMESTAMP DEFAULT (CURRENT_DATE + INTERVAL '30 days')
      `);
      console.log('✅ expiry_date column added');
    } else {
      console.log('expiry_date column already exists');
    }
    
    // Update existing users to have 30 days from now
    await pool.query(`
      UPDATE users 
      SET expiry_date = CURRENT_DATE + INTERVAL '30 days'
      WHERE expiry_date IS NULL
    `);
    console.log('✅ Updated existing users');
    
    // Show users with their expiry dates
    const users = await pool.query(`
      SELECT email, expiry_date, 
             EXTRACT(DAY FROM (expiry_date - CURRENT_DATE)) as days_left
      FROM users
      LIMIT 5
    `);
    
    console.log('\n📋 Users with expiry dates:');
    users.rows.forEach(u => {
      console.log(`  ${u.email}: ${u.expiry_date?.toISOString().split('T')[0]} (${u.days_left} days left)`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addExpiryDate();
