import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/barcodedb';

async function migrate() {
  const sql = postgres(connectionString);
  // Railway CWD = /app/backend, schema is at ../database/001_schema.sql
  const root = join(process.cwd(), '..');
  const schemaPath = join(root, 'database', '001_schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  await sql.unsafe(schema);
  console.log('Migration complete');
  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
