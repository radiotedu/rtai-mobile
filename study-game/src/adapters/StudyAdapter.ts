export type StudyRoomId = 'library' | 'chim-alan' | 'sports-center' | 'auditorium' | 'learning-lab'

export interface StudyAccount {
  id: string
  displayName: string
  authenticated: boolean
}

export interface StudyPointBalance {
  global: number
  studyToday: number
  dailyCap: number
  authoritative: boolean
}

export interface StudyPresence {
  userId: string
  displayName: string
  roomId: StudyRoomId
  nodeId: string
  seatId: string | null
  color: number
  equippedWearableIds?: readonly string[]
}

export interface StudyChatMessage {
  id: string
  userId: string
  displayName: string
  text: string
  createdAt: number
}

export interface StudySeatReservation {
  roomId: StudyRoomId
  seatId: string
  reservedAt: number
}

export interface StudySession {
  account: StudyAccount
  points: StudyPointBalance
  ownedWearableIds: readonly string[]
  equippedWearableIds: readonly string[]
}

export interface StudyTimeSummary {
  todaySeconds: number
  monthSeconds: number
  totalSeconds: number
}

export interface StudyRoomInstance {
  id: string
  roomId: StudyRoomId
  number: number
  occupancy: number
  capacity: number
  preferredInstanceFull: boolean
}

export interface StudyWorldEvent {
  id: string
  title: string
  description: string
  location: string
  startsAt: string | null
  endsAt: string | null
  rewardGold: number
  registered: boolean
  status: 'upcoming' | 'active' | 'completed'
}

export type StudyPlayerReportReason = 'harassment' | 'spam' | 'unsafe-profile' | 'other'

export interface StudyHeartbeatInput {
  roomId: StudyRoomId
  nodeId: string
  seatId: string | null
  position: { x: number; y: number }
  interaction: 'idle' | 'walking' | 'seated' | 'spark' | 'rock'
  focused: boolean
  foreground: boolean
}

export type Awaitable<T> = T | Promise<T>

export interface StudyAdapter {
  readonly authoritativeInventory?: boolean
  session(): StudySession
  roomInstance?(roomId: StudyRoomId): StudyRoomInstance | null
  presence(roomId: StudyRoomId): readonly StudyPresence[]
  enterRoom(roomId: StudyRoomId, nodeId: string): Awaitable<void>
  reserveSeat(roomId: StudyRoomId, seatId: string): Awaitable<StudySeatReservation>
  releaseSeat(): Awaitable<void>
  equipWearable(id: string, slot?: string): Awaitable<StudySession>
  purchaseWearable(id: string, idempotencyKey: string): Awaitable<StudySession>
  sendChat(text: string, roomId?: StudyRoomId): Awaitable<StudyChatMessage>
  reportPlayer?(targetUserId: string, roomId: StudyRoomId, reason: StudyPlayerReportReason): Promise<void>
  listEvents?(): Promise<readonly StudyWorldEvent[]>
  registerEvent?(eventId: string): Promise<StudyWorldEvent>
  initialize?(): Promise<void>
  refreshPresence?(roomId: StudyRoomId): Promise<readonly StudyPresence[]>
  refreshChat?(roomId: StudyRoomId): Promise<readonly StudyChatMessage[]>
  heartbeatPresence?(input: Omit<StudyHeartbeatInput, 'interaction' | 'focused' | 'foreground'>): Promise<void>
  startStudySession?(roomId: StudyRoomId, clientSessionId: string): Promise<void>
  heartbeatStudySession?(input: StudyHeartbeatInput): Promise<number>
  finishStudySession?(): Promise<StudyTimeSummary>
  fetchSummary?(): Promise<StudyTimeSummary>
}

export class StudyAdapterError extends Error {
  constructor(readonly code: string, message = code) {
    super(`${code}: ${message}`)
    this.name = 'StudyAdapterError'
  }
}
