// Exercise the deployed Gold service SQL against an in-memory PostgreSQL engine.
// This script never loads .env, opens a network DB connection, or starts a server.
const assert = require('node:assert/strict');
const path = require('node:path');
const {createRequire} = require('node:module');

async function main() {
  const [releaseRoot, toolsRoot] = process.argv.slice(2);
  assert.ok(releaseRoot && toolsRoot, 'Usage: node scripts/verify-gold-isolated.cjs <backend-release-root> <directory-with-pglite-installed>');
  const requireBackend = createRequire(path.resolve(releaseRoot, 'package.json'));
  const requireTools = createRequire(path.resolve(toolsRoot, 'package.json'));
  const {PGlite} = requireTools('@electric-sql/pglite');
  const pg = new PGlite('memory://');
  let pendingClient = Promise.resolve();
  const query = async (sql, params) => {
    const result = await pg.query(sql, params);
    return {...result, rowCount: result.affectedRows ?? result.rows.length};
  };
  const isolatedDb = {
    query,
    pool: {
      connect: async () => {
        const previous = pendingClient;
        let release;
        pendingClient = new Promise(resolve => { release = resolve; });
        await previous;
        return {query, release};
      },
    },
  };
  // Intercept the exact DB module before importing any backend implementation.
  const dbModule = requireBackend.resolve('./dist/db');
  require.cache[dbModule] = {id: dbModule, filename: dbModule, loaded: true, exports: {db: isolatedDb}};
  const {awardUserPoints, spendUserPoints} = requireBackend('./dist/services/gamification');
  const userId = '00000000-0000-4000-8000-000000000001';
  let checks = 0;
  const check = async (name, fn) => { await fn(); checks++; console.log(`PASS | ${name}`); };
  try {
    await pg.exec(`
      CREATE TABLE users (id UUID PRIMARY KEY, rank_score BIGINT DEFAULT 0, is_guest BOOLEAN DEFAULT FALSE, updated_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE user_points (
        user_id UUID PRIMARY KEY REFERENCES users(id), lifetime_points BIGINT DEFAULT 0,
        spendable_points BIGINT DEFAULT 0 CHECK (spendable_points >= 0), monthly_points BIGINT DEFAULT 0,
        listening_points BIGINT DEFAULT 0, events_points BIGINT DEFAULT 0, games_points BIGINT DEFAULT 0,
        social_points BIGINT DEFAULT 0, jukebox_points BIGINT DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE user_monthly_rank_scores (user_id UUID REFERENCES users(id), year_month TEXT, score BIGINT DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT now(), PRIMARY KEY(user_id, year_month));
      CREATE TABLE points_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), amount BIGINT,
        category TEXT, source_type TEXT, source_id TEXT, idempotency_key TEXT,
        balance_after BIGINT, metadata JSONB, created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE UNIQUE INDEX ledger_idempotency ON points_ledger(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
    `);
    await query('INSERT INTO users(id) VALUES ($1)', [userId]);
    const award = {userId, amount: 100, category: 'games', sourceType: 'isolated_game', sourceId: 'round-1', idempotencyKey: 'isolated-award-1'};
    const spend = {userId, amount: 35, category: 'market', sourceType: 'isolated_market', sourceId: 'item-1', idempotencyKey: 'isolated-spend-1'};
    const balance = async () => (await query('SELECT * FROM user_points WHERE user_id=$1', [userId])).rows[0];
    const ledgerCount = async () => Number((await query('SELECT count(*) AS count FROM points_ledger')).rows[0].count);

    await check('award persists in balance, lifetime rank and monthly rank', async () => {
      await awardUserPoints(award);
      const points = await balance();
      assert.equal(Number(points.spendable_points), 100);
      assert.equal(Number(points.lifetime_points), 100);
      assert.equal(Number(points.games_points), 100);
      assert.equal(Number((await query('SELECT rank_score FROM users WHERE id=$1', [userId])).rows[0].rank_score), 100);
      assert.equal(Number((await query('SELECT score FROM user_monthly_rank_scores WHERE user_id=$1', [userId])).rows[0].score), 100);
    });
    await check('duplicate award does not credit twice', async () => {
      await awardUserPoints(award);
      assert.equal(Number((await balance()).spendable_points), 100);
      assert.equal(await ledgerCount(), 1);
    });
    await check('reusing award key with another amount is rejected', async () => {
      await assert.rejects(awardUserPoints({...award, amount: 101}), /GOLD_IDEMPOTENCY_PAYLOAD_MISMATCH/);
      assert.equal(Number((await balance()).spendable_points), 100);
    });
    await check('spending changes wallet but preserves lifetime and monthly points', async () => {
      await spendUserPoints(spend);
      const points = await balance();
      assert.equal(Number(points.spendable_points), 65);
      assert.equal(Number(points.lifetime_points), 100);
      assert.equal(Number(points.monthly_points), 100);
    });
    await check('duplicate purchase does not debit twice', async () => {
      await spendUserPoints(spend);
      assert.equal(Number((await balance()).spendable_points), 65);
      assert.equal(await ledgerCount(), 2);
    });
    await check('purchase key cannot be reused for a different product', async () => {
      await assert.rejects(spendUserPoints({...spend, sourceId: 'item-2'}), /GOLD_IDEMPOTENCY_PAYLOAD_MISMATCH/);
      assert.equal(await ledgerCount(), 2);
    });
    await check('insufficient funds roll back both debit and ledger claim', async () => {
      await assert.rejects(spendUserPoints({...spend, amount: 66, idempotencyKey: 'too-expensive'}), /INSUFFICIENT_GOLD/);
      assert.equal(Number((await balance()).spendable_points), 65);
      assert.equal(await ledgerCount(), 2);
    });
    await check('separate reward categories accumulate in the same wallet', async () => {
      for (const category of ['listening', 'events', 'social', 'jukebox']) {
        await awardUserPoints({...award, category, amount: 10, sourceId: category, idempotencyKey: category});
      }
      const points = await balance();
      assert.equal(Number(points.spendable_points), 105);
      assert.equal(Number(points.lifetime_points), 140);
      assert.equal(await ledgerCount(), 6);
    });
    await check('ledger balances reconcile with the wallet', async () => {
      const sums = (await query('SELECT sum(amount) AS amount FROM points_ledger WHERE user_id=$1', [userId])).rows[0];
      assert.equal(Number(sums.amount), Number((await balance()).spendable_points));
      assert.equal(Number((await query('SELECT count(*) AS count FROM points_ledger WHERE balance_after IS NULL')).rows[0].count), 0);
    });
    console.log(`PASS | isolated Gold persistence | ${checks} checks | production database connections=0`);
  } finally {
    await pg.close();
    delete require.cache[dbModule];
  }
}
main().catch(error => { console.error(`FAIL | isolated Gold persistence | ${error.message}`); process.exitCode = 1; });
