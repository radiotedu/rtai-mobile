import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

function readScreen(name: string) {
  return fs.readFileSync(path.join(__dirname, '..', 'src', 'screens', name), 'utf8');
}

describe('mobile Account and Gold product contract', () => {
  const profileSource = readScreen('ProfileScreen.tsx');
  const homeSource = readScreen('HomeScreen.tsx');
  const marketSource = readScreen('MarketScreen.tsx');
  const avatarClosetSource = readScreen(path.join('study', 'AvatarClosetScreen.tsx'));
  const eventsSource = readScreen('EventsScreen.tsx');
  const gamesSource = readScreen('GamesScreen.tsx');
  const leaderboardSource = readScreen('LeaderboardScreen.tsx');
  const screenCopySource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'i18n', 'screenCopy.ts'),
    'utf8',
  );
  const loginSource = readScreen(path.join('auth', 'LoginScreen.tsx'));
  const registerSource = readScreen(path.join('auth', 'RegisterScreen.tsx'));
  const listeningSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'goldListeningService.ts'),
    'utf8',
  );

  it('labels spendable and earned currency as Gold without renaming API fields', () => {
    expect(marketSource).toContain('spendable_points');
    expect(marketSource).toContain('{item.cost_points} Gold');
    expect(marketSource).not.toContain('Harcanabilir XP');
    expect(eventsSource).toContain('events.goldEarned');
    expect(gamesSource).toContain('Gold');
    expect(homeSource).toContain("copy('home.goldBalance')");
    expect(screenCopySource).toContain("'home.goldBalance': 'Gold balance'");
    expect(leaderboardSource).toContain('leaderboard.lifetime');
    expect(homeSource).toContain('lifetime_points');
    expect(marketSource).toContain('notifyGoldBalanceChanged(serverSpendablePoints)');
    expect(avatarClosetSource).toContain('purchase.spendable_points ?? purchase.points?.spendable_points');
    expect(avatarClosetSource).toContain('notifyGoldBalanceChanged(serverSpendablePoints)');
  });

  it('uses the shared TEDÜ login and GDPR-aware registration contract', () => {
    expect(loginSource).toContain('authCopy(i18n.language, key)');
    expect(loginSource).toContain('copy(\'login.tedu\')');
    expect(registerSource).toContain('copy(\'register.age\')');
    expect(registerSource).toContain('copy(\'register.terms\')');
    expect(registerSource).toContain('copy(\'register.privacy\')');
  });

  it('uses server-timed rotating nonces for radio Gold instead of trusted duration', () => {
    expect(listeningSource).toContain("'/economy/listening/start'");
    expect(listeningSource).toContain("'/economy/listening/heartbeat'");
    expect(listeningSource).toContain('nonce');
    expect(listeningSource).toContain('is_playing: true');
    expect(listeningSource).not.toContain('/gamification/listening/heartbeat');
    expect(listeningSource).not.toContain('listened_seconds');
  });

  it('provides a separate destructive server-backed account deletion flow', () => {
    expect(profileSource).toContain('deleteAccount');
    expect(profileSource).toContain("confirmation: 'DELETE'");
    expect(profileSource).toContain('secureTextEntry');
    expect(profileSource).toContain("style: 'destructive'");
    expect(profileSource).toContain('copy(\'profile.deleteDataText\')');
    expect(screenCopySource).toContain('Account-owned Gold');
    expect(screenCopySource).toContain('Study inventory');

    const deletionHandler = profileSource.match(
      /const handleDeleteAccount[\s\S]*?(?=\n\s*const handle|\n\s*return \()/,
    )?.[0] ?? '';
    expect(deletionHandler).toContain('deleteAccount(');
    expect(deletionHandler).not.toContain('logout(');
  });
});
