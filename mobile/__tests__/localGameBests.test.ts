import AsyncStorage from '@react-native-async-storage/async-storage';
import {getLocalBest, loadLocalBest, recordLocalBest, subscribeToLocalBests} from '../src/services/localGameBests';

describe('device-only arcade records', () => {
  it('restores a record and does not lower it after a weaker round', async () => {
    await AsyncStorage.setItem('@radiotedu/arcade-best-v1/restore', '900');
    expect(await loadLocalBest('restore')).toBe(900);
    expect(await recordLocalBest('restore', 400)).toBe(false);
    expect(getLocalBest('restore')).toBe(900);
  });

  it('keeps concurrent results in increasing order and notifies the screen', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToLocalBests(listener);
    await Promise.all([recordLocalBest('race', 120), recordLocalBest('race', 480), recordLocalBest('race', 200)]);
    expect(getLocalBest('race')).toBe(480);
    expect(await AsyncStorage.getItem('@radiotedu/arcade-best-v1/race')).toBe('480');
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    await recordLocalBest('race', 600);
    expect(listener).not.toHaveBeenCalled();
  });

  it.each(['broken', '-1', 'Infinity', '12.5'])('ignores corrupt stored scores: %s', async raw => {
    const game = `corrupt-${raw}`;
    await AsyncStorage.setItem(`@radiotedu/arcade-best-v1/${game}`, raw);
    expect(await loadLocalBest(game)).toBe(0);
  });

  it('keeps game records separate and ignores invalid round results', async () => {
    await recordLocalBest('snake', 100);
    await recordLocalBest('memory', 300);
    for (const score of [NaN, Infinity, -10, 1.5]) {
      expect(await recordLocalBest('snake', score)).toBe(false);
    }
    expect(getLocalBest('snake')).toBe(100);
    expect(getLocalBest('memory')).toBe(300);
  });

  it('does not block gameplay when local storage fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('unavailable'));
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    await expect(recordLocalBest('storage-failure', 500)).resolves.toBe(true);
    expect(getLocalBest('storage-failure')).toBe(500);
    jest.restoreAllMocks();
  });
});
