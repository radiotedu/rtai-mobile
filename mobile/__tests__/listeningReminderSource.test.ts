import fs from 'fs';
import path from 'path';
import {describe, expect, it} from '@jest/globals';

const read = (relative: string) =>
  fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

describe('localized listening reminders', () => {
  it('schedules sparse reminders only after notification permission', () => {
    const consent = read('src/screens/ConsentScreen.tsx');
    const scheduler = read(
      'android/app/src/main/java/com/radiotedumobile/notifications/ListeningReminderReceiver.kt',
    );
    expect(consent).toContain("permission === 'granted'");
    expect(scheduler).toContain('MIN_DELAY_DAYS = 4');
    expect(scheduler).toContain('MAX_DELAY_DAYS = 7');
    expect(scheduler).toContain('setAndAllowWhileIdle');
    expect(scheduler).toContain('ListeningReminderScheduler.scheduleSaved(context)');
  });
});
