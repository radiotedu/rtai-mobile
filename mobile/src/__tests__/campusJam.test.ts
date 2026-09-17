import {
  createJamRoom,
  joinJamRoom,
  leaveJamRoom,
  getActiveJamRoom,
  sendJamReaction,
  subscribeToJamRoom,
  subscribeToJamReactions,
  addSimulatedListener,
  POPULAR_JAM_EMOJIS,
  getLocalListenerId,
  startJamPolling,
  stopJamPolling,
} from '../services/campusJamService';
import * as playbackQueue from '../services/playbackQueue';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('Tuna'),
  setItem: jest.fn().mockResolvedValue(null),
}));

jest.mock('../services/playbackQueue', () => ({
  playTrackById: jest.fn().mockResolvedValue(true),
}));

describe('Campus Jam Service (Birlikte Dinle)', () => {
  beforeEach(() => {
    leaveJamRoom();
    jest.clearAllMocks();
  });

  it('creates a new jam room with 6-digit code and host listener', async () => {
    const room = await createJamRoom('radiotedu-main', 'RadioTEDU', 'Ahmet');
    expect(room).toBeTruthy();
    expect(room.code).toMatch(/^\d{6}$/);
    expect(room.channelId).toBe('radiotedu-main');
    expect(room.hostName).toBe('Ahmet');
    expect(room.isHost).toBe(true);
    expect(room.listeners.length).toBe(1);
    expect(room.listeners[0].name).toBe('Ahmet');

    expect(getActiveJamRoom()).toEqual(room);
  });

  it('joins a room with 6-digit code and synchronizes playback', async () => {
    const joined = await joinJamRoom('123456', 'radiotedu-jazz', 'RadioTEDU Jazz', 'Elif');
    expect(joined).toBeTruthy();
    expect(joined?.code).toBe('123456');
    expect(joined?.channelId).toBe('radiotedu-jazz');
    expect(joined?.listeners.length).toBe(2);
    expect(joined?.listeners.some(l => l.name === 'Elif')).toBe(true);
    expect(playbackQueue.playTrackById).toHaveBeenCalledWith('radiotedu-jazz');
  });

  it('rejects invalid room codes', async () => {
    const result1 = await joinJamRoom('123', 'radiotedu-jazz', 'Jazz');
    expect(result1).toBeNull();

    const result2 = await joinJamRoom('abc', 'radiotedu-jazz', 'Jazz');
    expect(result2).toBeNull();
  });

  it('broadcasts emoji reactions to subscribers', async () => {
    await createJamRoom('radiotedu-main', 'RadioTEDU', 'Zeynep');

    const receivedReactions: any[] = [];
    const unsubscribe = subscribeToJamReactions(rx => {
      receivedReactions.push(rx);
    });

    const rx = sendJamReaction('🔥', 'Zeynep');
    expect(rx).toBeTruthy();
    expect(rx?.emoji).toBe('🔥');
    expect(rx?.senderName).toBe('Zeynep');
    expect(receivedReactions.length).toBe(1);
    expect(receivedReactions[0].emoji).toBe('🔥');

    unsubscribe();
  });

  it('adds simulated listeners and leaves the room cleanly', async () => {
    await createJamRoom('radiotedu-main', 'RadioTEDU', 'Deniz');

    addSimulatedListener('Kerem');
    expect(getActiveJamRoom()?.listeners.length).toBe(2);

    leaveJamRoom();
    expect(getActiveJamRoom()).toBeNull();
  });

  it('tracks local listener ID and manages polling lifecycle', () => {
    expect(getLocalListenerId()).toMatch(/^listener-/);

    expect(() => {
      startJamPolling('123456');
      stopJamPolling();
    }).not.toThrow();
  });
});
