'use strict';

const fs = require('node:fs');

const backendRoot = process.env.RADIOTEDU_ACCOUNT_BACKEND || 'C:/inetpub/rtjukebox-releases/20260828-ecosystem-r1';
const envPath = process.env.RADIOTEDU_ACCOUNT_ENV || `${backendRoot}/.env`;
const pgPath = process.env.RADIOTEDU_PG_MODULE || `${backendRoot}/node_modules/pg`;
const { Pool } = require(pgPath);

const env = Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (!match) return [];
  return [[match[1], match[2].trim().replace(/^['"]|['"]$/g, '')]];
}));

const pool = new Pool({ connectionString: env.DATABASE_URL });

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const result = await client.query(`
      SELECT u.id::text AS id,
             LOWER(u.email) AS email,
             CASE WHEN LOWER(COALESCE(u.preferred_language, '')) = 'en' THEN 'en' ELSE 'tr' END AS preferred_language
      FROM external_identities identity
      JOIN users u ON u.id = identity.user_id
      WHERE identity.provider = 'erp'
        AND identity.last_verified_at IS NOT NULL
        AND COALESCE(u.is_guest, FALSE) = FALSE
        AND COALESCE(u.is_banned, FALSE) = FALSE
        AND u.email IS NOT NULL
      ORDER BY u.id
    `);
    process.stdout.write(JSON.stringify(result.rows));
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
})().catch((error) => {
  process.stderr.write(`ERP newsletter export failed: ${String(error.message || 'unknown error').replace(/[\r\n]+/g, ' ')}\n`);
  process.exit(1);
});
