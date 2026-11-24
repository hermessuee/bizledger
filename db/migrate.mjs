import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found in .env.local');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function runMigrations() {
  console.log('Connecting to Neon Lakebase Postgres via TCP/TLS...');
  await client.connect();
  console.log('✓ Connected successfully');

  const migration001 = fs.readFileSync(
    path.resolve(process.cwd(), 'db/migrations/001_initial_schema.sql'),
    'utf8'
  );
  
  console.log('Applying 001_initial_schema.sql...');
  await client.query(migration001);
  console.log('✓ Migration 001 applied successfully');

  const seed = fs.readFileSync(path.resolve(process.cwd(), 'db/seed.sql'), 'utf8');
  console.log('Applying seed.sql...');
  await client.query(seed);
  console.log('✓ Seed data applied successfully');

  // Verify
  const bizRes = await client.query('SELECT count(*) as count FROM businesses');
  console.log(`✓ Verification query: Found ${bizRes.rows[0].count} business(es) in Neon Lakebase Postgres`);

  const userRes = await client.query('SELECT count(*) as count FROM users');
  console.log(`✓ Verification query: Found ${userRes.rows[0].count} user(s) in Neon Lakebase Postgres`);

  const chqRes = await client.query('SELECT count(*) as count FROM cheques');
  console.log(`✓ Verification query: Found ${chqRes.rows[0].count} cheque(s) in Neon Lakebase Postgres`);

  await client.end();
}

runMigrations().catch(async (err) => {
  console.error('Migration failed:', err);
  await client.end().catch(() => {});
  process.exit(1);
});
