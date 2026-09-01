'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = {accounts: [], credentials: [], goldAdminCredential: '', schema: false, tables: []};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--release-root') args.releaseRoot = argv[++index];
    else if (value === '--schema') args.schema = true;
    else if (value === '--tables') args.tables = String(argv[++index] || '').split(',').filter(Boolean);
    else if (value === '--credential') args.credentials.push(String(argv[++index] || ''));
    else if (value === '--account') args.accounts.push(String(argv[++index] || ''));
    else if (value === '--gold-admin-credential') args.goldAdminCredential = String(argv[++index] || '');
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.releaseRoot) throw new Error('--release-root is required.');
  return args;
}

function readEnvironment(filePath) {
  const result = {};
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
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
  if (environment.DATABASE_URL) {
    return {connectionString: environment.DATABASE_URL};
  }
  return {
    database: environment.DB_NAME,
    host: environment.DB_HOST || '127.0.0.1',
    password: environment.DB_PASSWORD,
    port: Number(environment.DB_PORT || 5432),
    user: environment.DB_USER,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const releaseRoot = path.resolve(args.releaseRoot);
  const environmentPath = path.join(releaseRoot, '.env');
  if (!fs.existsSync(environmentPath)) throw new Error(`Environment file not found: ${environmentPath}`);

  const environment = readEnvironment(environmentPath);
  const {Pool} = require(path.join(releaseRoot, 'node_modules', 'pg'));
  const pool = new Pool(databaseConfig(environment));
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const relevantNames = tables.rows
      .map(row => row.table_name)
      .filter(name => args.tables.length
        ? args.tables.includes(name)
        : /(account|user|gold|ledger|game|study|juke|queue|vote|ticket|event|session|device|econom)/i.test(name));
    const columns = relevantNames.length
      ? await client.query(`
          SELECT table_name, column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ANY($1::text[])
          ORDER BY table_name, ordinal_position
        `, [relevantNames])
      : {rows: []};

    const groupedColumns = {};
    for (const row of columns.rows) {
      (groupedColumns[row.table_name] ||= []).push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
      });
    }

    const count = async sql => Number((await client.query(sql)).rows[0].count);
    const checks = [];
    const addCheck = async (name, sql) => {
      const violations = await count(sql);
      checks.push({name, ok: violations === 0, violations});
    };

    await addCheck('account emails are unique ignoring case', `
      SELECT COUNT(*) FROM (
        SELECT LOWER(email) FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1
      ) duplicates
    `);
    await addCheck('account usernames are unique ignoring case', `
      SELECT COUNT(*) FROM (
        SELECT LOWER(username) FROM users
        WHERE username IS NOT NULL AND BTRIM(username) <> ''
        GROUP BY LOWER(username) HAVING COUNT(*) > 1
      ) duplicates
    `);
    await addCheck('Gold balances are non-negative', `
      SELECT COUNT(*) FROM user_points
      WHERE lifetime_points < 0 OR spendable_points < 0 OR monthly_points < 0
         OR listening_points < 0 OR events_points < 0 OR games_points < 0
         OR social_points < 0 OR jukebox_points < 0
    `);
    await addCheck('Gold balances belong to accounts', `
      SELECT COUNT(*) FROM user_points points
      LEFT JOIN users account ON account.id = points.user_id
      WHERE account.id IS NULL
    `);
    await addCheck('Gold ledger rows belong to accounts', `
      SELECT COUNT(*) FROM points_ledger ledger
      LEFT JOIN users account ON account.id = ledger.user_id
      WHERE account.id IS NULL
    `);
    await addCheck('Gold idempotency keys are unique', `
      SELECT COUNT(*) FROM (
        SELECT idempotency_key FROM points_ledger
        WHERE idempotency_key IS NOT NULL
        GROUP BY idempotency_key HAVING COUNT(*) > 1
      ) duplicates
    `);
    await addCheck('latest Gold ledger balance matches account balance', `
      SELECT COUNT(*) FROM user_points points
      JOIN LATERAL (
        SELECT balance_after FROM points_ledger ledger
        WHERE ledger.user_id = points.user_id AND ledger.balance_after IS NOT NULL
        ORDER BY ledger.created_at DESC NULLS LAST, ledger.id DESC LIMIT 1
      ) latest ON TRUE
      WHERE latest.balance_after <> points.spendable_points
    `);
    await addCheck('Gold activity counters are monotonic', `
      SELECT COUNT(*) FROM gold_activity_progress
      WHERE eligible_seconds < 0 OR completed_units < 0 OR rewarded_units < 0
         OR rewarded_units > completed_units
    `);
    await addCheck('Gold economy rules have valid amounts and caps', `
      SELECT COUNT(*) FROM gold_economy_rules
      WHERE amount <= 0 OR (daily_cap IS NOT NULL AND daily_cap < 0)
    `);
    await addCheck('game awards and scores are non-negative', `
      SELECT COUNT(*) FROM game_score_submissions
      WHERE score < 0 OR points_awarded < 0
    `);
    await addCheck('event registrations reference accounts and events', `
      SELECT COUNT(*) FROM event_registrations registration
      LEFT JOIN users account ON account.id = registration.user_id
      LEFT JOIN app_events event ON event.id = registration.event_id
      WHERE account.id IS NULL OR event.id IS NULL
    `);
    await addCheck('issued ticket codes are unique', `
      SELECT COUNT(*) FROM (
        SELECT ticket_code FROM event_registrations
        WHERE ticket_code IS NOT NULL AND BTRIM(ticket_code) <> ''
        GROUP BY ticket_code HAVING COUNT(*) > 1
      ) duplicates
    `);
    await addCheck('Juke devices have unique codes', `
      SELECT COUNT(*) FROM (
        SELECT LOWER(device_code) FROM devices
        GROUP BY LOWER(device_code) HAVING COUNT(*) > 1
      ) duplicates
    `);
    await addCheck('Juke queue references devices, songs and accounts', `
      SELECT COUNT(*) FROM queue_items item
      LEFT JOIN devices device ON device.id = item.device_id
      LEFT JOIN songs song ON song.id = item.song_id
      LEFT JOIN users account ON account.id = item.added_by
      WHERE device.id IS NULL OR song.id IS NULL OR account.id IS NULL
    `);
    await addCheck('Juke vote counters are non-negative', `
      SELECT COUNT(*) FROM queue_items
      WHERE COALESCE(upvotes, 0) < 0 OR COALESCE(downvotes, 0) < 0
    `);
    await addCheck('Juke votes reference queue items and accounts', `
      SELECT COUNT(*) FROM votes vote
      LEFT JOIN queue_items item ON item.id = vote.queue_item_id
      LEFT JOIN users account ON account.id = vote.user_id
      WHERE item.id IS NULL OR account.id IS NULL OR vote.vote_type NOT IN (-1, 1)
    `);
    await addCheck('voting candidates reference rounds', `
      SELECT COUNT(*) FROM next_song_vote_candidates candidate
      LEFT JOIN next_song_vote_rounds round ON round.id = candidate.round_id
      WHERE round.id IS NULL
    `);
    await addCheck('voting ballots reference rounds, candidates and accounts', `
      SELECT COUNT(*) FROM next_song_vote_ballots ballot
      LEFT JOIN next_song_vote_rounds round ON round.id = ballot.round_id
      LEFT JOIN next_song_vote_candidates candidate
        ON candidate.round_id = ballot.round_id AND candidate.candidate_id = ballot.candidate_id
      LEFT JOIN users account ON account.id = ballot.user_id
      WHERE round.id IS NULL OR candidate.candidate_id IS NULL OR account.id IS NULL
    `);
    await addCheck('only one voting round is active per device', `
      SELECT COUNT(*) FROM (
        SELECT source_device_id FROM next_song_vote_rounds
        WHERE status IN ('open', 'locked', 'active')
        GROUP BY source_device_id HAVING COUNT(*) > 1
      ) duplicates
    `);

    const metrics = {};
    for (const [name, sql] of Object.entries({
      accounts: 'SELECT COUNT(*) FROM users',
      goldBalances: 'SELECT COUNT(*) FROM user_points',
      goldLedgerRows: 'SELECT COUNT(*) FROM points_ledger',
      enabledGoldRules: 'SELECT COUNT(*) FROM gold_economy_rules WHERE enabled = TRUE',
      enabledGames: 'SELECT COUNT(*) FROM arcade_games WHERE is_active = TRUE',
      activeEvents: 'SELECT COUNT(*) FROM app_events WHERE is_active = TRUE',
      eventRegistrations: 'SELECT COUNT(*) FROM event_registrations',
      activeJukeDevices: 'SELECT COUNT(*) FROM devices WHERE COALESCE(is_active, FALSE) = TRUE',
      queuedJukeItems: "SELECT COUNT(*) FROM queue_items WHERE status IN ('queued', 'playing')",
      activeVotingRounds: "SELECT COUNT(*) FROM next_song_vote_rounds WHERE status IN ('open', 'locked', 'active')",
    })) metrics[name] = await count(sql);

    const credentialChecks = [];
    if (args.credentials.length) {
      const bcryptModule = fs.existsSync(path.join(releaseRoot, 'node_modules', 'bcryptjs'))
        ? 'bcryptjs'
        : 'bcrypt';
      const bcrypt = require(path.join(releaseRoot, 'node_modules', bcryptModule));
      for (const credential of args.credentials) {
        const separator = credential.indexOf('=');
        const identifier = credential.slice(0, separator).trim();
        const suppliedPassword = separator >= 0 ? credential.slice(separator + 1) : '';
        const result = await client.query(
          'SELECT password FROM devices WHERE LOWER(device_code) = LOWER($1) AND COALESCE(is_active, FALSE) = TRUE',
          [identifier],
        );
        const accountResult = await client.query(
          `SELECT password_hash, role FROM users
           WHERE LOWER(email) = LOWER($1) OR LOWER(COALESCE(username, '')) = LOWER($1)`,
          [identifier],
        );
        const storedPassword = String(result.rows[0]?.password || '');
        const storedAccountPassword = String(accountResult.rows[0]?.password_hash || '');
        const matches = async stored => stored && suppliedPassword
          ? /^\$2[aby]\$\d{2}\$/.test(stored)
            ? typeof bcrypt.compareSync === 'function'
              ? bcrypt.compareSync(suppliedPassword, stored)
              : await bcrypt.compare(suppliedPassword, stored)
            : stored === suppliedPassword
          : false;
        const devicePasswordValid = Boolean(await matches(storedPassword));
        const accountPasswordValid = Boolean(await matches(storedAccountPassword));
        credentialChecks.push({
          identifier,
          activeDeviceMatches: result.rowCount === 1,
          accountMatches: accountResult.rowCount === 1,
          accountRole: accountResult.rows[0]?.role || null,
          valid: devicePasswordValid || accountPasswordValid,
        });
      }
    }

    const accountChecks = [];
    for (const identifier of args.accounts) {
      const result = await client.query(
        `SELECT role, COALESCE(is_banned, FALSE) AS is_banned, COALESCE(is_guest, FALSE) AS is_guest
         FROM users
         WHERE LOWER(email) = LOWER($1) OR LOWER(COALESCE(username, '')) = LOWER($1)`,
        [identifier],
      );
      accountChecks.push({
        identifier,
        matches: result.rowCount,
        role: result.rows[0]?.role || null,
        isBanned: result.rows[0]?.is_banned ?? null,
        isGuest: result.rows[0]?.is_guest ?? null,
      });
    }

    let goldAdminCredentialCheck = null;
    if (args.goldAdminCredential) {
      const separator = args.goldAdminCredential.indexOf('=');
      const identifier = args.goldAdminCredential.slice(0, separator).trim();
      const suppliedPassword = separator >= 0 ? args.goldAdminCredential.slice(separator + 1) : '';
      const bcryptModule = fs.existsSync(path.join(releaseRoot, 'node_modules', 'bcryptjs'))
        ? 'bcryptjs'
        : 'bcrypt';
      const bcrypt = require(path.join(releaseRoot, 'node_modules', bcryptModule));
      const passwordHash = String(environment.GOLD_ADMIN_PASSWORD_HASH || '');
      const passwordValid = Boolean(passwordHash && suppliedPassword && (
        typeof bcrypt.compareSync === 'function'
          ? bcrypt.compareSync(suppliedPassword, passwordHash)
          : await bcrypt.compare(suppliedPassword, passwordHash)
      ));
      goldAdminCredentialCheck = {
        identifier,
        identifierMatches: identifier === environment.GOLD_ADMIN_IDENTIFIER,
        passwordValid,
        valid: identifier === environment.GOLD_ADMIN_IDENTIFIER && passwordValid,
      };
    }

    const report = {
      accountChecks,
      checks,
      credentialChecks,
      goldAdminCredentialCheck,
      failedChecks: checks.filter(check => !check.ok).length,
      metrics,
      mode: 'read-only',
      releaseRoot,
      tableCount: tables.rowCount,
      relevantTables: relevantNames,
    };
    if (args.schema) report.columns = groupedColumns;
    console.log(JSON.stringify(report, null, 2));
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(JSON.stringify({error: error.message}));
  process.exitCode = 1;
});
