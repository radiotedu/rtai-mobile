import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GameHistoryEntry {id: string; game: string; score: number; gold: number; at: number;}
const KEY = '@radiotedu/game-history-v1';
let writing = Promise.resolve();
export async function readGameHistory(): Promise<GameHistoryEntry[]> {
  try {
    const data = JSON.parse(await AsyncStorage.getItem(KEY) || '[]');
    return Array.isArray(data) ? data.filter(item => typeof item.id === 'string' &&
      typeof item.game === 'string' && Number.isSafeInteger(item.score) && item.score >= 0 &&
      Number.isSafeInteger(item.gold) && item.gold >= 0 && Number.isFinite(item.at)).slice(0, 50) : [];
  } catch {return [];}
}
// Informational device history only. Never read this value to award Gold.
export function recordGameHistory(entry: GameHistoryEntry): Promise<void> {
  writing = writing.then(async () => {
    const old = await readGameHistory();
    const next = [entry, ...old.filter(item => item.id !== entry.id)].slice(0, 50);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }).catch(() => {});
  return writing;
}
