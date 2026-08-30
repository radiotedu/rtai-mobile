import fs from 'fs';
import path from 'path';
import {describe, expect, it} from '@jest/globals';

import {
  buildRegistrationRequest,
  createErpAuthAttemptCoordinator,
  normalizeUser,
  registrationPreferredLanguage,
} from '../src/context/AuthContext';

describe('mobile auth context session contract', () => {
  it('normalizes the authoritative Gold balance independently from rank score', () => {
    expect(normalizeUser({
      id: 'user-1',
      email: 'listener@tedu.edu.tr',
      display_name: 'Listener',
      role: 'user',
      is_guest: false,
      rank_score: 900,
      gold_balance: 125,
      total_songs_added: 0,
      total_upvotes_received: 0,
    })).toEqual(expect.objectContaining({
      rank_score: 900,
      gold_balance: 125,
    }));
  });

  it('sends the effective app language only through the backend registration allowlist', () => {
    expect(buildRegistrationRequest(
      'listener@example.test',
      'correct-horse-battery-staple',
      'Listener',
      {legalAccepted: true, age: 22},
      'fr-FR',
    )).toEqual(expect.objectContaining({
      preferred_language: 'fr',
      terms_accepted: true,
      privacy_acknowledged: true,
      age: 22,
    }));
    expect(registrationPreferredLanguage('it-IT')).toBe('it');
    expect(registrationPreferredLanguage('jp')).toBe('jp');
    expect(registrationPreferredLanguage('unsupported')).toBe('en');
  });

  it('uses the configured API for startup verification and preserves transient sessions', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/context/AuthContext.tsx'),
      'utf8',
    );

    expect(source).toContain("api.get('/auth/me')");
    expect(source).toContain('isDefinitiveAuthRejection(error)');
    expect(source).not.toContain('await axios.get(`${API_URL}/auth/me`)');
    expect(source).not.toContain('await logout();');
  });

  it('bounds direct authentication requests instead of hanging indefinitely', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/context/AuthContext.tsx'),
      'utf8',
    );

    expect(source).toContain('AUTH_REQUEST_TIMEOUT_MS = 15000');
    expect(source.match(/timeout: AUTH_REQUEST_TIMEOUT_MS/g)?.length).toBe(3);
  });

  it('aborts and invalidates superseded ERP authentication attempts', () => {
    const attempts = createErpAuthAttemptCoordinator();
    const first = attempts.begin('start');

    expect(attempts.transition(first, 'waiting')).toBe(true);
    expect(first.phase).toBe('waiting');

    const second = attempts.begin('exchange');
    expect(first.controller.signal.aborted).toBe(true);
    expect(attempts.isCurrent(first)).toBe(false);
    expect(attempts.isCurrent(second)).toBe(true);

    attempts.invalidate();
    expect(second.controller.signal.aborted).toBe(true);
    expect(attempts.getCurrent()).toBeNull();
    expect(attempts.finish(second)).toBe(false);
  });

  it('guards ERP persistence and invalidates it from every newer auth action', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/context/AuthContext.tsx'),
      'utf8',
    );

    expect(source).toContain('startTeduLogin(attempt.controller.signal)');
    expect(source).toContain('attempt.controller.signal,');
    expect(source).toContain(
      'persistSession(session, () => isCurrentErpAttempt(attempt))',
    );
    expect(source).toContain('erpAttempts.getRevision() === initialRevision');
    expect(source.match(/invalidateErpAttempt\(\);/g)?.length).toBeGreaterThanOrEqual(5);
    expect(source).toContain('isMountedRef.current = false;');
    expect(source).toContain('erpAttempts.invalidate();');
  });
});
