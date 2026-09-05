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
    await pg.exec(`
      CREATE TABLE IF NOT EXISTS arcade_games (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug TEXT UNIQUE,
        title TEXT,
        point_rate NUMERIC,
        daily_point_limit INT,
        is_active BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS game_score_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id UUID REFERENCES arcade_games(id),
        user_id UUID REFERENCES users(id),
        score INT NOT NULL DEFAULT 0,
        points_awarded INT NOT NULL DEFAULT 0,
        client_round_id VARCHAR(120),
        reported_score INT,
        server_elapsed_seconds INT,
        verification_status VARCHAR(30) NOT NULL DEFAULT 'legacy',
        submitted_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_game_score_submissions_user_round
        ON game_score_submissions(user_id, client_round_id) WHERE client_round_id IS NOT NULL;
    `);
    const gameId = '00000000-0000-4000-8000-000000000002';
    await query(`INSERT INTO arcade_games (id, slug, title, point_rate, daily_point_limit, is_active, metadata)
      VALUES ($1, 'snake', 'Snake', 0.02, 50, true, '{"verification":"client-timed-session","surface":"mobile"}'::jsonb)`, [gameId]);

    const {handleGameScoreRequest, handleGameStartRequest} = requireBackend('./dist/routes/gamification');
    const {resetGameSessionProofsForTests} = requireBackend('./dist/services/gameSessionProof');
    const createMockRes = () => {
      const res = {
        statusCode: 200,
        body: null,
        status(code) { res.statusCode = code; return res; },
        json(payload) { res.body = payload; return res; },
      };
      return res;
    };

    const roundId = 'iso-round-retry-1';
    const startRes = createMockRes();
    await handleGameStartRequest({
      params: { gameId },
      body: { client_round_id: roundId, submission_source: 'mobile_game' },
      user: { id: userId, role: 'user' },
    }, startRes);
    assert.equal(startRes.statusCode, 201);
    const startData = startRes.body.data;

    const realNow = Date.now;
    Date.now = () => realNow() + 5000;
    try {
      const scoreBody = {
        score: 100,
        client_round_id: roundId,
        play_duration_ms: 5000,
        submission_source: 'mobile_game',
        session_id: startData.session.id,
        nonce: startData.nonce,
      };
      const scoreRes = createMockRes();
      await handleGameScoreRequest({
        params: { gameId },
        body: scoreBody,
        user: { id: userId, role: 'user' },
      }, scoreRes);
      assert.equal(scoreRes.statusCode, 201);
      assert.equal(scoreRes.body.data.points_awarded, 2);

      await check('lost response followed by exact retry returns committed result without double award', async () => {
        const retryRes = createMockRes();
        const ledgerBefore = await ledgerCount();
        await handleGameScoreRequest({
          params: { gameId },
          body: scoreBody,
          user: { id: userId, role: 'user' },
        }, retryRes);
        assert.equal(retryRes.statusCode, 200);
        assert.equal(retryRes.body.data.score, 100);
        assert.equal(retryRes.body.data.points_awarded, 2);
        assert.equal(retryRes.body.data.replayed, true);
        assert.equal(await ledgerCount(), ledgerBefore);
      });

      await check('retry with changed score for same round is rejected with conflict', async () => {
        const conflictRes = createMockRes();
        await handleGameScoreRequest({
          params: { gameId },
          body: {...scoreBody, score: 200},
          user: { id: userId, role: 'user' },
        }, conflictRes);
        assert.equal(conflictRes.statusCode, 409);
      });

      await check('process restart simulation recovers committed result without in-memory proof', async () => {
        resetGameSessionProofsForTests();
        const restartRetryRes = createMockRes();
        await handleGameScoreRequest({
          params: { gameId },
          body: scoreBody,
          user: { id: userId, role: 'user' },
        }, restartRetryRes);
        assert.equal(restartRetryRes.statusCode, 200);
        assert.equal(restartRetryRes.body.data.score, 100);
        assert.equal(restartRetryRes.body.data.points_awarded, 2);
        assert.equal(restartRetryRes.body.data.replayed, true);
      });
    } finally {
      Date.now = realNow;
    }

    console.log(`PASS | isolated Gold persistence | ${checks} checks | production database connections=0`);
  } finally {
    await pg.close();
    delete require.cache[dbModule];
  }
}
main().catch(error => { console.error(`FAIL | isolated Gold persistence | ${error.message}`); process.exitCode = 1; });
