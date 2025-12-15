const { Client } = require('pg');

async function init() {
  const client = new Client({
    user: 'postgres',
    host: '127.0.0.1',
    password: 'postgres',
    port: 5432,
    database: 'postgres', // Connect to default postgres DB
  });

  try {
    await client.connect();
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'micrapor_users'");
    if (res.rows.length === 0) {
      console.log('Creating database micrapor_users...');
      await client.query('CREATE DATABASE micrapor_users');
      console.log('Database created.');
    } else {
      console.log('Database micrapor_users already exists.');
    }
  } catch (e) {
    console.error('Error checking/creating DB:', e);
  } finally {
    await client.end();
  }
}

init();
