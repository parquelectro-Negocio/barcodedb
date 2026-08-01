import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/barcodedb';

// Single source of truth is the repo-root database/ folder. The backend/database
// copy is a legacy fallback kept in sync — reading a stale copy silently skips
// migrations (this once shipped a schema/DB mismatch to production).
function resolveSchemaPath(): string {
  const candidates = [
    join(__dirname, '..', '..', '..', 'database', '001_schema.sql'), // repo root
    join(__dirname, '..', '..', 'database', '001_schema.sql'),       // legacy fallback
  ];
  return candidates.find(existsSync) ?? candidates[0];
}

async function migrate() {
  const sql = postgres(connectionString);
  const schemaPath = resolveSchemaPath();
  console.log('Running migration from', schemaPath);
  const schema = readFileSync(schemaPath, 'utf-8');
  await sql.unsafe(schema);
  console.log('Migration complete');
  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
