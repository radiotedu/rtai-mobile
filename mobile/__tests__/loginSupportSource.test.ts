import fs from 'fs';
import path from 'path';
import {describe, expect, it} from '@jest/globals';

describe('login support controls', () => {
  it('provides a working password-reset support action', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/auth/LoginScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('onPress={handleForgotPassword}');
    expect(source).toContain('mailto:radio@tedu.edu.tr');
    expect(source).toContain('accessibilityRole="link"');
  });
});
