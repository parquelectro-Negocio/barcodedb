import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/barcodedb';

async function migrate() {
  const sql = postgres(connectionString);
  const schemaPath = join(__dirname, '..', '..', '..', 'database', '001_schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  await sql.unsafe(schema);
  console.log('Migration complete');
  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
