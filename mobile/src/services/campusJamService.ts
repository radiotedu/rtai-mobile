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

export interface JamChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface PublicJamRoom {
  code: string;
  channelId: string;
  channelName: string;
  hostName: string;
  listenersCount: number;
  createdAt: number;
}

export interface CampusJamRoom {
  code: string;
  channelId: string;
  channelName: string;
  hostName: string;
  isHost: boolean;
  isPublic?: boolean;
  listeners: JamListener[];
  createdAt: number;
}

const JAM_USERNAME_KEY = '@radiotedu/jam_username_v1';
export const POPULAR_JAM_EMOJIS = ['🔥', '🎧', '🎓', '❤️', '⚡', '🎉'];

let activeRoom: CampusJamRoom | null = null;
let localListenerId: string = `listener-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
let pollTimer: any = null;
const seenReactionIds = new Set<string>();
const seenMessageIds = new Set<string>();
let lastChatSendTime = 0;

const roomListeners = new Set<(room: CampusJamRoom | null) => void>();
const reactionListeners = new Set<(reaction: JamReaction) => void>();
const chatListeners = new Set<(message: JamChatMessage) => void>();

export function getLocalListenerId(): string {
  return localListenerId;
}

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

function notifyChatSubscribers(message: JamChatMessage): void {
  chatListeners.forEach(listener => {
    try {
      listener(message);
    } catch (err) {
      logSafeError('campusJam.notifyChat', err);
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

export const JAM_API_ENDPOINT = 'https://radiotedu.com/wp-json/radiotedu/v1/jam';

/**
 * Fetches all currently active public Jam rooms from server
 */
export async function fetchPublicJamRooms(): Promise<PublicJamRoom[]> {
  if (process.env.NODE_ENV === 'test') {
    return [];
  }
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), 5000);
    const res = await fetch(`${JAM_API_ENDPOINT}/public-rooms`, {
      signal: controller?.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data?.rooms)) {
        return data.rooms.map((r: any) => ({
          code: String(r.code),
          channelId: r.channel_id || 'radiotedu',
          channelName: r.channel_name || 'RadioTEDU',
          hostName: r.host_name || 'TEDÜ Dinleyicisi',
          listenersCount: Number(r.listeners_count || 1),
          createdAt: (r.created_at || 0) * 1000,
        }));
      }
    }
  } catch (err) {
    logSafeError('campusJam.fetchPublicRooms', err);
  }
  return [];
}

/**
 * Starts background polling to keep room listeners and reactions synchronized across devices
 */
export function startJamPolling(roomCode: string): void {
  stopJamPolling();
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  pollTimer = setInterval(async () => {
    if (!activeRoom || activeRoom.code !== roomCode) {
      stopJamPolling();
      return;
    }

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeout = setTimeout(() => controller?.abort(), 4000);
      const res = await fetch(`${JAM_API_ENDPOINT}/rooms/${roomCode}/state`, {
        signal: controller?.signal,
      });
      clearTimeout(timeout);

      if (res.status === 404) {
        // Room was closed or expired on server
        stopJamPolling();
        activeRoom = null;
        notifyRoomSubscribers();
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (!activeRoom || activeRoom.code !== roomCode) {
          return;
        }

        // 1. Sync Listeners
        if (Array.isArray(data.listeners)) {
          const mappedListeners: JamListener[] = data.listeners.map((l: any) => ({
            id: l.id,
            name: l.name,
            isHost: Boolean(l.is_host),
            joinedAt: (l.joined_at || 0) * 1000,
          }));

          const countChanged = mappedListeners.length !== activeRoom.listeners.length;
          const idsChanged = mappedListeners.some(
            (ml, idx) => activeRoom?.listeners[idx]?.id !== ml.id,
          );

          if (countChanged || idsChanged) {
            activeRoom = {
              ...activeRoom,
              listeners: mappedListeners,
            };
            notifyRoomSubscribers();
          }
        }

        // 2. Sync Incoming Reactions from other listeners
        if (Array.isArray(data.recent_reactions)) {
          for (const rx of data.recent_reactions) {
            if (rx && rx.id && !seenReactionIds.has(rx.id)) {
              seenReactionIds.add(rx.id);
              notifyReactionSubscribers({
                id: rx.id,
                emoji: rx.emoji,
                senderName: rx.sender_name || 'Dinleyici',
                timestamp: (rx.timestamp || 0) * 1000,
              });
            }
          }
        }

        // 3. Sync Incoming Ephemeral Chat Messages from other listeners
        if (Array.isArray(data.recent_messages)) {
          for (const msg of data.recent_messages) {
            if (msg && msg.id && !seenMessageIds.has(msg.id)) {
              seenMessageIds.add(msg.id);
              notifyChatSubscribers({
                id: msg.id,
                senderId: msg.sender_id || '',
                senderName: msg.sender_name || 'Dinleyici',
                text: msg.text || '',
                timestamp: (msg.timestamp || 0) * 1000,
              });
            }
          }
        }
      }
    } catch {
      // Non-blocking network drop tolerance
    }
  }, 2500);
}

/**
 * Stops background polling
 */
export function stopJamPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * Creates a new synchronized Jam Room for a channel
 */
export async function createJamRoom(
  channelId: string,
  channelName: string,
  customHostName?: string,
  isPublic: boolean = true,
): Promise<CampusJamRoom> {
  const hostName = customHostName || (await getStoredJamUsername());
  const hostListenerId = `listener-host-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  localListenerId = hostListenerId;
  let code = generateRoomCode();

  if (process.env.NODE_ENV !== 'test') {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeout = setTimeout(() => controller?.abort(), 6000);
      const res = await fetch(`${JAM_API_ENDPOINT}/create`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          channel_id: channelId,
          channel_name: channelName,
          host_name: hostName,
          host_id: hostListenerId,
          is_public: isPublic,
        }),
        signal: controller?.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data && data.code) {
          code = String(data.code);
        }
      }
    } catch (e) {
      logSafeError('campusJam.createApi', e);
    }
  }

  const hostListener: JamListener = {
    id: hostListenerId,
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
    isPublic,
    listeners: [hostListener],
    createdAt: Date.now(),
  };

  seenReactionIds.clear();
  seenMessageIds.clear();
  notifyRoomSubscribers();
  startJamPolling(code);
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
  let targetChannelId = channelId;
  let targetChannelName = channelName;
  let remoteHostName = 'TEDÜ Campus Host';
  const myListenerId = `listener-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  localListenerId = myListenerId;

  let initialListeners: JamListener[] = [];

  if (process.env.NODE_ENV !== 'test') {
    try {
      // 1. First get room details
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeout = setTimeout(() => controller?.abort(), 6000);
      const res = await fetch(`${JAM_API_ENDPOINT}/rooms/${cleanCode}`, {
        signal: controller?.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        return null;
      }
      const data = await res.json();
      if (data && data.channel_id) {
        targetChannelId = data.channel_id;
        targetChannelName = data.channel_name || channelName;
        remoteHostName = data.host_name || remoteHostName;
      }

      // 2. Register participant with POST /join
      const joinController = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const joinTimeout = setTimeout(() => joinController?.abort(), 6000);
      const joinRes = await fetch(`${JAM_API_ENDPOINT}/rooms/${cleanCode}/join`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          listener_id: myListenerId,
          listener_name: listenerName,
        }),
        signal: joinController?.signal,
      });
      clearTimeout(joinTimeout);

      if (!joinRes.ok) return null;

      if (joinRes.ok) {
        // Fetch current state to get full listener list
        try {
          const stateRes = await fetch(`${JAM_API_ENDPOINT}/rooms/${cleanCode}/state`);
          if (stateRes.ok) {
            const stateData = await stateRes.json();
            if (Array.isArray(stateData.listeners)) {
              initialListeners = stateData.listeners.map((l: any) => ({
                id: l.id,
                name: l.name,
                isHost: Boolean(l.is_host),
                joinedAt: (l.joined_at || 0) * 1000,
              }));
            }
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      logSafeError('campusJam.joinApi', e);
      return null;
    }
  }

  const myListener: JamListener = {
    id: myListenerId,
    name: listenerName,
    isHost: false,
    joinedAt: Date.now(),
  };

  if (initialListeners.length === 0) {
    initialListeners = [
      {
        id: 'host-1',
        name: remoteHostName,
        isHost: true,
        joinedAt: Date.now() - 60000,
      },
      myListener,
    ];
  } else if (!initialListeners.some(l => l.id === myListenerId)) {
    initialListeners.push(myListener);
  }

  activeRoom = {
    code: cleanCode,
    channelId: targetChannelId,
    channelName: targetChannelName,
    hostName: remoteHostName,
    isHost: false,
    listeners: initialListeners,
    createdAt: Date.now() - 60000,
  };

  // Sync playback immediately to the room's live channel
  try {
    await playTrackById(targetChannelId);
  } catch (err) {
    logSafeError('campusJam.syncPlayback', err);
  }

  seenReactionIds.clear();
  notifyRoomSubscribers();
  startJamPolling(cleanCode);
  return activeRoom;
}

/**
 * Leaves the active room and informs the server
 */
export function leaveJamRoom(): void {
  const roomToLeave = activeRoom;
  const leavingListenerId = localListenerId;

  stopJamPolling();
  activeRoom = null;
  seenReactionIds.clear();
  seenMessageIds.clear();
  lastChatSendTime = 0;
  notifyRoomSubscribers();

  if (roomToLeave && process.env.NODE_ENV !== 'test') {
    fetch(`${JAM_API_ENDPOINT}/rooms/${roomToLeave.code}/leave`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        listener_id: leavingListenerId,
      }),
    }).catch(err => {
      logSafeError('campusJam.leaveApi', err);
    });
  }
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

  const reactionId = `rx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  seenReactionIds.add(reactionId);

  const reaction: JamReaction = {
    id: reactionId,
    emoji,
    senderName:
      senderName ||
      activeRoom.listeners.find(l => l.id === localListenerId)?.name ||
      activeRoom.listeners[0]?.name ||
      'Dinleyici',
    timestamp: Date.now(),
  };

  notifyReactionSubscribers(reaction);

  if (process.env.NODE_ENV !== 'test') {
    const roomCode = activeRoom.code;
    fetch(`${JAM_API_ENDPOINT}/rooms/${roomCode}/react`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        emoji,
        sender_name: reaction.senderName,
      }),
    })
      .then(async res => {
        if (res.ok) {
          const data = await res.json();
          if (data?.reaction?.id) {
            seenReactionIds.add(data.reaction.id);
          }
        }
      })
      .catch(err => {
        logSafeError('campusJam.sendReactionApi', err);
      });
  }

  return reaction;
}

/**
 * Sends an ephemeral chat message to the room (Anti-mIRC, acoustic live overlay)
 */
export function sendJamChatMessage(
  text: string,
  senderName?: string,
): JamChatMessage | null {
  if (!activeRoom) {
    return null;
  }

  const clean = text.trim();
  if (!clean) {
    return null;
  }

  const now = Date.now();
  if (now - lastChatSendTime < 3000) {
    // 3-second client rate limit
    return null;
  }
  lastChatSendTime = now;

  const truncated = clean.length > 100 ? clean.substring(0, 100) : clean;
  const msgId = `msg-${now}-${Math.random().toString(36).slice(2, 6)}`;
  seenMessageIds.add(msgId);

  const myName =
    senderName ||
    activeRoom.listeners.find(l => l.id === localListenerId)?.name ||
    activeRoom.listeners[0]?.name ||
    'Dinleyici';

  const chatMessage: JamChatMessage = {
    id: msgId,
    senderId: localListenerId,
    senderName: myName,
    text: truncated,
    timestamp: now,
  };

  notifyChatSubscribers(chatMessage);

  if (process.env.NODE_ENV !== 'test') {
    const roomCode = activeRoom.code;
    fetch(`${JAM_API_ENDPOINT}/rooms/${roomCode}/chat`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        sender_id: localListenerId,
        sender_name: myName,
        message: truncated,
      }),
    })
      .then(async res => {
        if (res.ok) {
          const data = await res.json();
          if (data?.message?.id) {
            seenMessageIds.add(data.message.id);
          }
        }
      })
      .catch(err => {
        logSafeError('campusJam.sendChatApi', err);
      });
  }

  return chatMessage;
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
 * Subscribes to live ephemeral chat messages
 */
export function subscribeToJamChat(
  callback: (message: JamChatMessage) => void,
): () => void {
  chatListeners.add(callback);
  return () => {
    chatListeners.delete(callback);
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
