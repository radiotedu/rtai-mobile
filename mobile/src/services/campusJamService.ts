import AsyncStorage from '@react-native-async-storage/async-storage';
import {playTrackById} from './playbackQueue';
import {logSafeError} from '../utils/safeLog';

export interface JamListener {
  id: string;
  name: string;
  isHost: boolean;
  avatarUrl?: string;
  joinedAt: number;
}

export interface JamReaction {
  id: string;
  emoji: string;
  senderName: string;
  timestamp: number;
}

export interface CampusJamRoom {
  code: string;
  channelId: string;
  channelName: string;
  hostName: string;
  isHost: boolean;
  listeners: JamListener[];
  createdAt: number;
}

const JAM_USERNAME_KEY = '@radiotedu/jam_username_v1';
export const POPULAR_JAM_EMOJIS = ['🔥', '🎧', '🎓', '❤️', '⚡', '🎉'];

let activeRoom: CampusJamRoom | null = null;
const roomListeners = new Set<(room: CampusJamRoom | null) => void>();
const reactionListeners = new Set<(reaction: JamReaction) => void>();

function generateRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function notifyRoomSubscribers(): void {
  const current = activeRoom ? {...activeRoom, listeners: [...activeRoom.listeners]} : null;
  roomListeners.forEach(listener => {
    try {
      listener(current);
    } catch (err) {
      logSafeError('campusJam.notifyRoom', err);
    }
  });
}

function notifyReactionSubscribers(reaction: JamReaction): void {
  reactionListeners.forEach(listener => {
    try {
      listener(reaction);
    } catch (err) {
      logSafeError('campusJam.notifyReaction', err);
    }
  });
}

export async function getStoredJamUsername(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(JAM_USERNAME_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch {
    // fallback
  }
  return 'TEDÜ Dinleyicisi';
}

export async function setStoredJamUsername(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(JAM_USERNAME_KEY, name.trim());
  } catch (err) {
    logSafeError('campusJam.setUsername', err);
  }
}

/**
 * Creates a new synchronized Jam Room for a channel
 */
export async function createJamRoom(
  channelId: string,
  channelName: string,
  customHostName?: string,
): Promise<CampusJamRoom> {
  const hostName = customHostName || (await getStoredJamUsername());
  const code = generateRoomCode();

  const hostListener: JamListener = {
    id: `listener-${Date.now()}`,
    name: hostName,
    isHost: true,
    joinedAt: Date.now(),
  };

  activeRoom = {
    code,
    channelId,
    channelName,
    hostName,
    isHost: true,
    listeners: [hostListener],
    createdAt: Date.now(),
  };

  notifyRoomSubscribers();
  return activeRoom;
}

/**
 * Joins an existing Jam Room using its 6-digit code
 */
export async function joinJamRoom(
  roomCode: string,
  channelId: string,
  channelName: string,
  customName?: string,
): Promise<CampusJamRoom | null> {
  const cleanCode = roomCode.trim().replace(/[^0-9]/g, '');
  if (cleanCode.length !== 6) {
    return null;
  }

  const listenerName = customName || (await getStoredJamUsername());
  const myListener: JamListener = {
    id: `listener-${Date.now()}`,
    name: listenerName,
    isHost: false,
    joinedAt: Date.now(),
  };

  activeRoom = {
    code: cleanCode,
    channelId,
    channelName,
    hostName: 'TEDÜ Campus Host',
    isHost: false,
    listeners: [
      {
        id: 'host-1',
        name: 'TEDÜ Campus Host',
        isHost: true,
        joinedAt: Date.now() - 60000,
      },
      myListener,
    ],
    createdAt: Date.now() - 60000,
  };

  // Sync playback immediately to the room's live channel
  try {
    await playTrackById(channelId);
  } catch (err) {
    logSafeError('campusJam.syncPlayback', err);
  }

  notifyRoomSubscribers();
  return activeRoom;
}

/**
 * Leaves the active room
 */
export function leaveJamRoom(): void {
  activeRoom = null;
  notifyRoomSubscribers();
}

/**
 * Gets the current active room
 */
export function getActiveJamRoom(): CampusJamRoom | null {
  return activeRoom;
}

/**
 * Sends a real-time emoji reaction to all listeners in the room
 */
export function sendJamReaction(emoji: string, senderName?: string): JamReaction | null {
  if (!activeRoom) {
    return null;
  }

  const reaction: JamReaction = {
    id: `rx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    emoji,
    senderName: senderName || activeRoom.listeners[0]?.name || 'Dinleyici',
    timestamp: Date.now(),
  };

  notifyReactionSubscribers(reaction);
  return reaction;
}

/**
 * Subscribes to room state changes
 */
export function subscribeToJamRoom(
  callback: (room: CampusJamRoom | null) => void,
): () => void {
  roomListeners.add(callback);
  callback(activeRoom);
  return () => {
    roomListeners.delete(callback);
  };
}

/**
 * Subscribes to live emoji reactions
 */
export function subscribeToJamReactions(
  callback: (reaction: JamReaction) => void,
): () => void {
  reactionListeners.add(callback);
  return () => {
    reactionListeners.delete(callback);
  };
}

/**
 * Adds a simulated campus listener (for demo / campus simulation)
 */
export function addSimulatedListener(name: string): void {
  if (!activeRoom) return;
  activeRoom.listeners.push({
    id: `listener-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name,
    isHost: false,
    joinedAt: Date.now(),
  });
  notifyRoomSubscribers();
}
