import fs from 'fs';
import path from 'path';
import {describe, expect, it} from '@jest/globals';

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

describe('credential-safe mobile diagnostics', () => {
  it('keeps raw auth and authenticated-screen errors out of console output', () => {
    const authenticatedScreens = [
      'src/screens/auth/LoginScreen.tsx',
      'src/screens/auth/RegisterScreen.tsx',
      'src/screens/EventsScreen.tsx',
      'src/screens/GamesScreen.tsx',
      'src/screens/HomeScreen.tsx',
      'src/screens/MarketScreen.tsx',
      'src/screens/ProfileScreen.tsx',
      'src/screens/LeaderboardScreen.tsx',
      'src/screens/games/MemoryGameScreen.tsx',
      'src/screens/games/RhythmTapScreen.tsx',
      'src/screens/games/SnakeScreen.tsx',
      'src/screens/games/TetrisScreen.tsx',
      'src/screens/games/WordGuessScreen.tsx',
    ];

    for (const screen of authenticatedScreens) {
      const source = readSource(screen);
      expect(source).toContain('logSafeError');
      expect(source).not.toMatch(/console\.(?:log|warn|error|debug)\s*\(/);
    }
  });

  it('logs only dev-gated error type, status, and stable code fields', () => {
    const source = readSource('src/utils/safeLog.ts');

    expect(source).toContain('if (!__DEV__) {');
    expect(source).toContain('candidate.response?.status');
    expect(source).toContain('candidate.response?.data?.code');
    expect(source).not.toContain('JSON.stringify');
    expect(source).not.toMatch(/candidate\.(?:config|headers|request|message|stack)/);
  });

  it('continues stripping credentials and payloads from rejected Axios errors', () => {
    const source = readSource('src/services/api.ts');

    expect(source).toContain("headers.delete('Authorization')");
    expect(source).toContain('delete (headers as Record<string, unknown>).Authorization');
    expect(source).toContain('error.config.data = undefined');
    expect(source).toContain('error.config.params = undefined');
    expect(source).toContain('Promise.reject(redactRejectedRequest(error))');
    expect(source).toContain('Promise.reject(redactRejectedRequest(refreshError))');
  });
});
