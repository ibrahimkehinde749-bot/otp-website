import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: '.env' });

(async function testDb() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 5000,
    });

    const [rows] = await conn.query('SELECT 1 as ok');
    console.log('Connection successful:', rows);
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('DB connection failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
