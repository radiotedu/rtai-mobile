import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Home Gold value precedence', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'screens', 'HomeScreen.tsx'),
    'utf8',
  );

  it('preserves authoritative zero values and falls back to account balance only when absent', () => {
    expect(source).toContain('accountHome?.points.lifetime_points ?? user?.rank_score ?? 0');
    expect(source).toContain('accountHome?.points.spendable_points ?? user?.gold_balance ?? 0');
    expect(source).toContain('accountHome?.points.monthly_points ?? user?.monthly_rank_score ?? 0');
    expect(source).not.toContain('home.points.lifetime_points ||');
    expect(source).not.toContain('home.points.spendable_points ||');
    expect(source).not.toContain('home.points.monthly_points ||');
    expect(source).toContain("copy('home.lifetimeGold')");
    expect(source).toContain("copy('home.goldBalance')");
    expect(source).toContain("copy('home.monthlyGold')");
    expect(source).not.toContain('label="Lifetime Gold"');
  });

  it('refreshes authoritative Gold whenever Home regains focus', () => {
    expect(source).toContain('useFocusEffect(');
    expect(source).toContain('void loadHome();');
  });
});
