import AsyncStorage from '@react-native-async-storage/async-storage';
import {AccessibilityInfo} from 'react-native';
import {useEffect, useSyncExternalStore} from 'react';

export type GameEffects = 'calm' | 'standard' | 'lively';
let preferences = {effects: 'standard' as GameEffects, haptics: true, reducedMotion: false};
const listeners = new Set<() => void>();
let initialized = false;
let writes = Promise.resolve();
const emit = () => listeners.forEach(fn => fn());
export function getGamePreferences() {return preferences;}
export function setGamePreferences(update: Partial<Pick<typeof preferences, 'effects' | 'haptics'>>) {
  preferences = {...preferences, ...update}; emit();
  const value = JSON.stringify({effects: preferences.effects, haptics: preferences.haptics});
  writes = writes.then(() => AsyncStorage.setItem('@radiotedu/game-preferences-v1', value)).catch(() => {});
}
export function useGamePreferences() {
  useEffect(() => {
    if (initialized) {return;}
    initialized = true;
    AsyncStorage.getItem('@radiotedu/game-preferences-v1').then(raw => {
      if (!raw) {return;}
      const saved = JSON.parse(raw);
      preferences = {...preferences,
        effects: ['calm', 'standard', 'lively'].includes(saved.effects) ? saved.effects : 'standard',
        haptics: saved.haptics !== false}; emit();
    }).catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    const update = (reducedMotion: boolean) => {
      if (active) {preferences = {...preferences, reducedMotion}; emit();}
    };
    AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {active = false; subscription.remove();};
  }, []);
  return useSyncExternalStore(fn => {listeners.add(fn); return () => {listeners.delete(fn);};}, getGamePreferences);
}
