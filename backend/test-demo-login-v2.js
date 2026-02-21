
const { Pool } = require('pg');

// Main DB Connection
const pool = new Pool({
  connectionString: 'postgres://begum:KORDO@212.108.132.92:5432/react',
  ssl: false // Render requires SSL, but let's try false if previous attempts failed locally
  // Wait, the error was "The server does not support SSL connections" when I used ssl: false?
  // No, the error was "The server does not support SSL connections" when I used ssl: { rejectUnauthorized: false }
  // This means the server (212.108.132.92) does NOT support SSL?
  // But Render supports SSL.
  // Wait, 212.108.132.92 is NOT Render! It's an IP address.
  // Is this your VPS?
  // If so, it might not have SSL enabled!
});

// Demo Branch Connection (Render)
const branchPool = new Pool({
    host: 'dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com',
    user: 'frfood_user',
    password: 'OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt',
    database: 'react',
    port: 5432,
    ssl: { rejectUnauthorized: false } // Render REQUIRES SSL
});

async function testLoginFlow() {
  const client = await pool.connect();
  try {
    console.log('1. Connecting to Main DB (Users)...');
    
    const demoEmail = 'demo@micrapor.com';
    const res = await client.query('SELECT * FROM users WHERE email = $1', [demoEmail]);
    
    if (res.rows.length === 0) {
        console.log('❌ User not found!');
        return;
    }
    
    const user = res.rows[0];
    console.log('✅ User found:', user.email);
    
    console.log('2. Fetching Branches...');
    const branchesRes = await client.query('SELECT * FROM branches WHERE user_id = $1', [user.id]);
    
    if (branchesRes.rows.length === 0) {
        console.log('❌ No branches found!');
        return;
    }
    
    const branch = branchesRes.rows[0];
    console.log('✅ Branch found:', branch.name);
    console.log('Branch Host:', branch.db_host);
    
    console.log('3. Connecting to Branch DB (Products)...');
    
    // Check if branch host is Render
    if (branch.db_host.includes('render.com')) {
        console.log('Branch is on Render, using SSL...');
        const branchClient = await branchPool.connect();
        try {
            const productRes = await branchClient.query('SELECT COUNT(*) FROM product');
            console.log('✅ Connected to Branch DB! Product count:', productRes.rows[0].count);
        } catch (err) {
            console.error('❌ Failed to connect to Branch DB:', err.message);
        } finally {
            branchClient.release();
        }
    } else {
        console.log('Branch is NOT on Render (Using Main DB connection for test if same host)...');
        // If it's the same host/db as main, we can reuse client
        // But for simulation let's skip
    }

  } catch (err) {
    console.error('❌ Main DB Error:', err.message);
  } finally {
    client.release();
    pool.end();
    branchPool.end();
  }
}

testLoginFlow();
