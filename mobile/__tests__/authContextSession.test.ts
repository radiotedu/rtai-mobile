import fs from 'fs';
import path from 'path';
import {describe, expect, it} from '@jest/globals';

import {normalizeUser} from '../src/context/AuthContext';

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
});
