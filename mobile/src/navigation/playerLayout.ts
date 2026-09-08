import {useSyncExternalStore} from 'react';

let tabHeight = 0;
const listeners = new Set<() => void>();
export function setPlayerTabHeight(height: number): void {
  if (!Number.isFinite(height) || height < 0 || height === tabHeight) {return;}
  tabHeight = height;
  listeners.forEach(listener => listener());
}
export function usePlayerTabHeight(): number {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => {listeners.delete(listener);};
  }, () => tabHeight);
}
export function playerBottomOffset(isTab: boolean, height: number, inset: number): number | null {
  if (isTab && height <= 0) {return null;}
  return isTab ? height + 8 : Math.max(inset, 10) + 8;
}
