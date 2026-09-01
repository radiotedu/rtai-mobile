import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

import {verifyProductionAccount} from './verify-production-account.mjs';

function parseArgs(argv) {
  const result = {apiBase: 'http://127.0.0.1:3000/api/v1'};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--release-root') result.releaseRoot = argv[++index];
    else if (argv[index] === '--account') result.account = argv[++index];
    else if (argv[index] === '--api-base') result.apiBase = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!result.releaseRoot || !result.account) {
    throw new Error('--release-root and --account are required.');
  }
  return result;
}

function readEnvironment(filePath) {
  const result = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function databaseConfig(environment) {
  if (environment.DATABASE_URL) return {connectionString: environment.DATABASE_URL};
  return {
    database: environment.DB_NAME,
    host: environment.DB_HOST || '127.0.0.1',
    password: environment.DB_PASSWORD,
    port: Number(environment.DB_PORT || 5432),
    user: environment.DB_USER,
  };
}

const args = parseArgs(process.argv.slice(2));
const releaseRoot = path.resolve(args.releaseRoot);
const environment = readEnvironment(path.join(releaseRoot, '.env'));
if (!environment.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');

const requireFromRelease = createRequire(path.join(releaseRoot, 'package.json'));
const {Pool} = requireFromRelease('pg');
const jwt = requireFromRelease('jsonwebtoken');
const pool = new Pool(databaseConfig(environment));
const client = await pool.connect();
let account;
try {
  await client.query('BEGIN TRANSACTION READ ONLY');
  const result = await client.query(
    `SELECT id, email, role, COALESCE(is_banned, FALSE) AS is_banned
     FROM users
     WHERE LOWER(email) = LOWER($1) OR LOWER(COALESCE(username, '')) = LOWER($1)`,
    [args.account],
  );
  if (result.rowCount !== 1) throw new Error('Expected exactly one matching account.');
  account = result.rows[0];
  if (account.is_banned) throw new Error('The audit account is banned.');
  await client.query('ROLLBACK');
} finally {
  client.release();
  await pool.end();
}

const token = jwt.sign(
  {id: account.id, email: account.email, role: account.role},
  environment.JWT_SECRET,
  {algorithm: 'HS256', expiresIn: '5m'},
);
const result = await verifyProductionAccount({
  apiBase: args.apiBase,
  expectedAccountId: account.id,
  mutate: false,
  token,
});

console.log(JSON.stringify({
  account: args.account,
  checks: result.checks,
  counts: result.counts,
  mode: 'read-only',
  mutated: result.mutated,
}, null, 2));
