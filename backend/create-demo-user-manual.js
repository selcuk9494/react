
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: 'postgres://begum:KORDO@212.108.132.92:5432/react',
  ssl: false
});

async function createDemoUserManual() {
  const client = await pool.connect();
  try {
    console.log('Creating demo user manually...');
    
    const demoEmail = 'demo@micrapor.com';
    const demoPassword = 'demo';
    const hashedPassword = await bcrypt.hash(demoPassword, 10);
    
    // Check if user exists
    const checkRes = await client.query('SELECT * FROM users WHERE email = $1', [demoEmail]);
    
    let userId;
    
    if (checkRes.rows.length === 0) {
        console.log('User not found, creating...');
        // Create user
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        
        const insertRes = await client.query(`
            INSERT INTO users (email, password, selected_branch, expiry_date, is_admin, allowed_reports)
            VALUES ($1, $2, 0, $3, false, null)
            RETURNING id
        `, [demoEmail, hashedPassword, expiryDate]);
        
        userId = insertRes.rows[0].id;
        console.log('User created with ID:', userId);
    } else {
        console.log('User already exists.');
        userId = checkRes.rows[0].id;
    }
    
    // Create Branch
    const branchRes = await client.query('SELECT * FROM branches WHERE user_id = $1', [userId]);
    
    if (branchRes.rows.length === 0) {
        console.log('Creating demo branch...');
        await client.query(`
            INSERT INTO branches (user_id, name, db_host, db_port, db_name, db_user, db_password, kasa_no)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            userId,
            'Demo Şube (FastRest)',
            'dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com',
            5432,
            'react',
            'frfood_user',
            'OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt',
            1
        ]);
        console.log('Branch created.');
    } else {
        console.log('Branch already exists.');
    }
    
    console.log('Done.');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

createDemoUserManual();
