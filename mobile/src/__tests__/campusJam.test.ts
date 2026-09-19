import {
  createJamRoom,
  joinJamRoom,
  leaveJamRoom,
  getActiveJamRoom,
  sendJamReaction,
  subscribeToJamReactions,
  subscribeToJamChat,
  sendJamChatMessage,
  fetchPublicJamRooms,
  addSimulatedListener,
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

  it('creates public or private jam rooms based on isPublic flag', async () => {
    const publicRoom = await createJamRoom('radiotedu-main', 'RadioTEDU', 'Ali', true);
    expect(publicRoom.isPublic).toBe(true);

    const privateRoom = await createJamRoom('radiotedu-rock', 'RadioTEDU Rock', 'Veli', false);
    expect(privateRoom.isPublic).toBe(false);
  });

  it('sends ephemeral chat messages and notifies subscribers', async () => {
    await createJamRoom('radiotedu-main', 'RadioTEDU', 'Cem');

    const receivedMessages: any[] = [];
    const unsubscribe = subscribeToJamChat(msg => {
      receivedMessages.push(msg);
    });

    const msg = sendJamChatMessage('Harika bir parça!', 'Cem');
    expect(msg).toBeTruthy();
    expect(msg?.text).toBe('Harika bir parça!');
    expect(msg?.senderName).toBe('Cem');
    expect(receivedMessages.length).toBe(1);
    expect(receivedMessages[0].text).toBe('Harika bir parça!');

    unsubscribe();
  });

  it('enforces 3-second client cooldown for chat messages', async () => {
    await createJamRoom('radiotedu-main', 'RadioTEDU', 'Selin');

    const msg1 = sendJamChatMessage('İlk mesaj');
    expect(msg1).toBeTruthy();

    // Immediate second message must be blocked by rate limiter
    const msg2 = sendJamChatMessage('İkinci mesaj');
    expect(msg2).toBeNull();
  });

  it('truncates chat messages exceeding 100 characters', async () => {
    await createJamRoom('radiotedu-main', 'RadioTEDU', 'Murat');

    // Advance time slightly to bypass rate limit
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);

    const longText = 'A'.repeat(150);
    const msg = sendJamChatMessage(longText);
    expect(msg).toBeTruthy();
    expect(msg?.text.length).toBe(100);

    (Date.now as any).mockRestore();
  });

  it('fetches public jam rooms safely', async () => {
    const rooms = await fetchPublicJamRooms();
    expect(Array.isArray(rooms)).toBe(true);
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
