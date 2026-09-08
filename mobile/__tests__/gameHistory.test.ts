import AsyncStorage from '@react-native-async-storage/async-storage';
import {readGameHistory, recordGameHistory} from '../src/services/gameHistory';

test('serializes rounds and updates a retried result instead of duplicating it', async () => {
  await AsyncStorage.clear();
  await Promise.all([
    recordGameHistory({id: 'a', game: 'MemoryGame', score: 42, gold: 0, at: 1}),
    recordGameHistory({id: 'b', game: 'MemoryGame', score: 50, gold: 2, at: 2}),
    recordGameHistory({id: 'a', game: 'MemoryGame', score: 42, gold: 1, at: 1}),
  ]);
  const rows = await readGameHistory();
  expect(rows).toHaveLength(2);
  expect(rows.find(row => row.id === 'a')?.gold).toBe(1);
});
