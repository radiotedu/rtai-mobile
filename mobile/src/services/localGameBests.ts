import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@radiotedu/arcade-best-v1/';
const values = new Map<string, number>();
const loads = new Map<string, Promise<number>>();
const writes = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

export function getLocalBest(game: string): number {
  return values.get(game) ?? 0;
}

export function subscribeToLocalBests(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function loadLocalBest(game: string): Promise<number> {
  const pending = loads.get(game);
  if (pending) { return pending; }
  const load = AsyncStorage.getItem(PREFIX + game).then(raw => {
    const parsed = raw === null ? 0 : Number(raw);
    const stored = Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
    values.set(game, Math.max(getLocalBest(game), stored));
    listeners.forEach(listener => listener());
    return getLocalBest(game);
  }).catch(() => getLocalBest(game));
  loads.set(game, load);
  return load;
}

// Device-only practice records. These values never enter the Gold API.
export async function recordLocalBest(game: string, score: number): Promise<boolean> {
  if (!Number.isSafeInteger(score) || score < 0) { return false; }
  await loadLocalBest(game);
  if (score <= getLocalBest(game)) { return false; }
  values.set(game, score);
  listeners.forEach(listener => listener());
  // Serialize writes so a slower earlier round cannot overwrite a later record.
  const write = (writes.get(game) ?? Promise.resolve()).then(() =>
    AsyncStorage.setItem(PREFIX + game, String(getLocalBest(game))),
  ).catch(() => { /* A storage failure must not interrupt a game. */ });
  writes.set(game, write);
  await write;
  return true;
}
