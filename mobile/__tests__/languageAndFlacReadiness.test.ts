import {describe, expect, it} from '@jest/globals';
import fs from 'fs';
import path from 'path';

import {RTL_LANGUAGES, SUPPORTED_LANGUAGES} from '../src/i18n';
import {RADIO_CHANNELS} from '../src/data/radioChannels';
import {shouldShowFlacMobileDataWarning} from '../src/services/networkQualityPolicy';

describe('language and FLAC readiness', () => {
  it('ships the supported six-language set with Arabic RTL support', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'tr', 'ru', 'ar', 'de', 'fr']);
    expect(RTL_LANGUAGES).toContain('ar');

    for (const lang of SUPPORTED_LANGUAGES) {
      expect(fs.existsSync(path.join(__dirname, `../src/i18n/locales/${lang}.json`))).toBe(true);
    }
  });

  it('keeps every locale key aligned with English and removes the retired Dutch locale', () => {
    const flatten = (value: Record<string, unknown>, prefix = '', output: string[] = []) => {
      Object.entries(value).forEach(([key, child]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (child && typeof child === 'object' && !Array.isArray(child)) {
          flatten(child as Record<string, unknown>, fullKey, output);
        } else {
          output.push(fullKey);
        }
      });
      return output.sort();
    };
    const english = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, '../src/i18n/locales/en.json'), 'utf8')));
    for (const lang of SUPPORTED_LANGUAGES) {
      const keys = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, `../src/i18n/locales/${lang}.json`), 'utf8')));
      expect(keys).toEqual(english);
    }
    expect(fs.existsSync(path.join(__dirname, '../src/i18n/locales/nl.json'))).toBe(false);
  });

  it('warns before FLAC playback on mobile data while allowing wifi playback', () => {
    const jazz = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-jazz')!;
    const main = RADIO_CHANNELS.find(channel => channel.id === 'radiotedu-main')!;

    expect(shouldShowFlacMobileDataWarning(jazz, 'flac', 'mobile-data')).toBe(true);
    expect(shouldShowFlacMobileDataWarning(jazz, 'flac', 'wifi')).toBe(false);
    expect(shouldShowFlacMobileDataWarning(main, 'flac', 'mobile-data')).toBe(false);
  });

  it('keeps the Android stream buffer valid for KotlinAudio rebuffering', () => {
    const source = fs.readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
    expect(source).toMatch(/minBuffer:\s*10/);
    expect(source).toMatch(/maxBuffer:\s*30/);
    expect(source).toMatch(/playBuffer:\s*5/);
    expect(source).toMatch(/backBuffer:\s*5/);

    const queueSource = fs.readFileSync(path.join(__dirname, '../src/services/playbackQueue.ts'), 'utf8');
    expect(queueSource).toMatch(/NORMAL_CONNECT_TIMEOUT_MS = 8000/);
    expect(queueSource).toMatch(/FLAC_CONNECT_TIMEOUT_MS = 15000/);
  });
});
