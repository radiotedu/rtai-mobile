import {NativeModules, Platform} from 'react-native';

const LiveVoteBridge = NativeModules.RadioTeduLiveVoteBridge as
  | {update(roundId: string, title: string, startedAtMs: number, endsAtMs: number): void; finish(): void}
  | undefined;

export function updateLiveVotingActivity(input: {
  roundId: string;
  title: string;
  startedAt: string;
  endsAt: string;
  active: boolean;
}): void {
  if (Platform.OS !== 'android' || !LiveVoteBridge) {
    return;
  }
  if (!input.active) {
    LiveVoteBridge.finish();
    return;
  }
  const startedAtMs = Date.parse(input.startedAt);
  const endsAtMs = Date.parse(input.endsAt);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endsAtMs) || endsAtMs <= startedAtMs) {
    return;
  }
  LiveVoteBridge.update(input.roundId, input.title, startedAtMs, endsAtMs);
}

export function finishLiveVotingActivity(): void {
  if (Platform.OS === 'android') {
    LiveVoteBridge?.finish();
  }
}
