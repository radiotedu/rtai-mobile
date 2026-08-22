import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Profile Android readiness panel', () => {
  it('keeps internal platform QA claims out of end-user account settings', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/screens/ProfileScreen.tsx'), 'utf8');

    expect(source).not.toContain('buildAndroidReadiness');
    expect(source).not.toContain('profile.readiness.android16');
    expect(source).not.toContain('readinessStatusCopyKey');
    expect(source).toContain('handleEnableNotifications');
    expect(source).toContain('handleNotificationPreferenceToggle');
  });
});
