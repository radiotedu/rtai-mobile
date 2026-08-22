import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Profile Android readiness panel', () => {
  it('shows Android 16 QPR, Android 17, Google Maps, XR, adaptive layout, and audio quality statuses', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/screens/ProfileScreen.tsx'), 'utf8');

    expect(source).toContain("['profile.readiness.android16Qpr', androidReadiness.android16Qpr]");
    expect(source).toContain("['profile.readiness.android17', androidReadiness.android17]");
    expect(source).toContain("['profile.readiness.googleMaps', androidReadiness.googleMapsMediaControls]");
    expect(source).toContain("['profile.readiness.xr', androidReadiness.xrSafe]");
    expect(source).toContain("['profile.readiness.adaptive', androidReadiness.adaptiveLayout]");
    expect(source).toContain("['profile.readiness.audio', androidReadiness.audioQuality]");
    expect(source).toContain('copy(readinessStatusCopyKey(value))');
  });
});
