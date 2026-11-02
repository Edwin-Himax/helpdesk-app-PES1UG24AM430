const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT) || 5432,
        database: process.env.PGDATABASE || 'campus_helpdesk',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
      }
);

async function main() {
  console.log('Connecting to PostgreSQL to initialize schema...');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS help_requests (
      id SERIAL PRIMARY KEY,
      student_name VARCHAR(50) NOT NULL,
      message VARCHAR(200) NOT NULL,
      resolved BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT now()
    );
  `;

  try {
    await pool.query(createTableQuery);
    console.log('Successfully created/verified help_requests table.');
    process.exit(0);
  } catch (error) {
    console.error('Error creating database table:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
