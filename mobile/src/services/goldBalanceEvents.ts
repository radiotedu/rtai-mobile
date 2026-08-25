type GoldBalanceListener = (goldBalance: number) => void;

const listeners = new Set<GoldBalanceListener>();

export function subscribeGoldBalanceChanges(listener: GoldBalanceListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyGoldBalanceChanged(goldBalance: number) {
  if (!Number.isInteger(goldBalance) || goldBalance < 0) {
    return;
  }
  for (const listener of listeners) {
    listener(goldBalance);
  }
}
