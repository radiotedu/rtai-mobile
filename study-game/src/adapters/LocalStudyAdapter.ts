import {
  StudyAdapterError,
  type StudyAdapter,
  type StudyAccount,
  type StudyChatMessage,
  type StudyHeartbeatInput,
  type StudyHomeSnapshot,
  type StudyPresence,
  type StudyRoomId,
  type StudyPlayerReportReason,
  type StudyRoomInstance,
  type StudySeatReservation,
  type StudySession,
  type StudyTimeSummary,
  type StudyWorldEvent,
  type SocialArcadeChoice,
  type SocialArcadeSnapshot,
} from './StudyAdapter'

const OWNED = Object.freeze([
  'short-hair', 'radio-hoodie', 'radiotedu-tee', 'varsity-jacket', 'jeans', 'black-cargos',
  'sneakers', 'boots', 'bucket-hat', 'beanie',
])

const FAKE_PRESENCE: readonly StudyPresence[] = Object.freeze([
  { userId: 'local-selin', displayName: 'Selin', roomId: 'library', nodeId: 'approach:upper-back-left', seatId: 'upper-back-left', color: 0xd99249 },
  { userId: 'local-mert', displayName: 'Mert', roomId: 'library', nodeId: 'approach:upper-near-left', seatId: 'upper-near-left', color: 0x4f91c7 },
  { userId: 'local-deniz', displayName: 'Deniz', roomId: 'chim-alan', nodeId: 'row-2-mid', seatId: 'amfi-b2', color: 0x9d6fc0 },
])
const CHAT_UNSAFE_CONTROLS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g

const LOCAL_WEARABLE_SLOTS: Readonly<Record<string, string>> = Object.freeze({
  'short-hair': 'hair',
  'radio-hoodie': 'top',
  'radiotedu-tee': 'top',
  'varsity-jacket': 'top',
  jeans: 'bottom',
  'black-cargos': 'bottom',
  sneakers: 'shoes',
  boots: 'shoes',
  'bucket-hat': 'hat',
  beanie: 'hat',
})

const LOCAL_EVENTS: readonly StudyWorldEvent[] = Object.freeze([
  Object.freeze({
    id: 'campus-care-saturday',
    title: 'Campus Care Saturday',
    description: 'Meet at the campus garden, form a team, and help clean shared outdoor spaces.',
    location: 'TEDU Campus Garden',
    startsAt: null,
    endsAt: null,
    rewardGold: 40,
    registered: false,
    status: 'upcoming',
  }),
  Object.freeze({
    id: 'library-focus-night',
    title: 'Library Focus Night',
    description: 'Join a quiet group study session and complete a focused study block together.',
    location: 'Library',
    startsAt: null,
    endsAt: null,
    rewardGold: 20,
    registered: false,
    status: 'active',
  }),
  Object.freeze({
    id: 'auditorium-live-broadcast',
    title: 'TEDU Live: Auditorium',
    description: 'Join the student audience and help RadioTEDU produce a live campus broadcast.',
    location: 'Fatma–Semih Akbil Auditorium',
    startsAt: null,
    endsAt: null,
    rewardGold: 30,
    registered: false,
    status: 'upcoming',
  }),
])

export interface LocalStudyAdapterOptions {
  now?: () => number
  chatLimit?: number
  chatWindowMs?: number
  account?: StudyAccount
  globalPoints?: number
}

export class LocalStudyAdapter implements StudyAdapter {
  readonly #now: () => number
  readonly #chatLimit: number
  readonly #chatWindowMs: number
  readonly #account: StudyAccount
  readonly #globalPoints: number
  readonly #equipped = new Set<string>()
  readonly #equippedBySlot = new Map<string, string>()
  readonly #chatTimestamps: number[] = []
  readonly #messages = new Map<StudyRoomId, StudyChatMessage[]>()
  readonly #registeredEvents = new Set<string>()
  #poolDive: { id: string; round: number; score: number; prompt: SocialArcadeChoice; nonce: string } | null = null
  #activeSeat: StudySeatReservation | null = null
  #activeRoom: StudyRoomId = 'library'
  #activeNodeId = 'spawn'
  #messageSequence = 0
  #activeStudyStartedAt: number | null = null
  #summary: StudyTimeSummary = { todaySeconds: 0, monthSeconds: 0, totalSeconds: 0 }

  constructor(options: LocalStudyAdapterOptions = {}) {
    this.#now = options.now ?? Date.now
    this.#chatLimit = options.chatLimit ?? 5
    this.#chatWindowMs = options.chatWindowMs ?? 10_000
    this.#account = options.account ?? { id: 'local-student', displayName: 'TEDU Student', authenticated: true }
    this.#globalPoints = Math.max(0, Math.floor(options.globalPoints ?? 240))
  }

  session(): StudySession {
    return {
      account: this.#account,
      points: { global: this.#globalPoints, studyToday: Math.floor(this.#summary.todaySeconds / 60), dailyCap: 25, authoritative: false },
      ownedWearableIds: OWNED,
      equippedWearableIds: [...this.#equipped],
    }
  }

  presence(roomId: StudyRoomId): readonly StudyPresence[] {
    return FAKE_PRESENCE.filter((entry) => entry.roomId === roomId)
  }

  roomInstance(roomId: StudyRoomId): StudyRoomInstance {
    return {
      id: `${roomId}-1`, roomId, number: 1,
      occupancy: this.presence(roomId).length + 1,
      capacity: { library: 51, 'chim-alan': 9, 'sports-center': 18, auditorium: 90, 'learning-lab': 24 }[roomId],
      preferredInstanceFull: false,
    }
  }

  enterRoom(roomId: StudyRoomId, nodeId: string): void {
    this.releaseSeat()
    this.#activeRoom = roomId
    this.#activeNodeId = nodeId
  }

  reserveSeat(roomId: StudyRoomId, seatId: string): StudySeatReservation {
    if (this.#activeSeat) throw new StudyAdapterError('SEAT_ALREADY_RESERVED')
    if (FAKE_PRESENCE.some((entry) => entry.roomId === roomId && entry.seatId === seatId)) {
      throw new StudyAdapterError('SEAT_OCCUPIED')
    }
    const reservation = Object.freeze({ roomId, seatId, reservedAt: this.#now() })
    this.#activeRoom = roomId
    this.#activeNodeId = `seat:${seatId}`
    this.#activeSeat = reservation
    return reservation
  }

  releaseSeat(): void {
    this.#activeSeat = null
  }

  equipWearable(id: string, requestedSlot?: string): StudySession {
    if (!OWNED.includes(id)) throw new StudyAdapterError('WEARABLE_NOT_OWNED', id)
    const slot = requestedSlot ?? LOCAL_WEARABLE_SLOTS[id]
    if (!slot || LOCAL_WEARABLE_SLOTS[id] !== slot) throw new StudyAdapterError('WEARABLE_SLOT_REQUIRED', id)
    const previous = this.#equippedBySlot.get(slot)
    if (previous) this.#equipped.delete(previous)
    this.#equippedBySlot.set(slot, id)
    this.#equipped.add(id)
    return this.session()
  }

  purchaseWearable(_id: string, _idempotencyKey: string): StudySession {
    throw new StudyAdapterError('LOCAL_POINTS_READ_ONLY')
  }

  sendChat(text: string, roomId: StudyRoomId = this.#activeRoom): StudyChatMessage {
    const normalized = text.replace(CHAT_UNSAFE_CONTROLS, ' ').replace(/\s+/g, ' ').trim()
    if (!normalized) throw new StudyAdapterError('CHAT_EMPTY')
    if (normalized.length > 180) throw new StudyAdapterError('CHAT_TOO_LONG')
    const now = this.#now()
    while (this.#chatTimestamps.length && now - this.#chatTimestamps[0]! >= this.#chatWindowMs) this.#chatTimestamps.shift()
    if (this.#chatTimestamps.length >= this.#chatLimit) throw new StudyAdapterError('CHAT_RATE_LIMITED')
    this.#chatTimestamps.push(now)
    const message = {
      id: `local-message-${++this.#messageSequence}`,
      userId: this.#account.id,
      displayName: this.#account.displayName,
      text: normalized,
      createdAt: now,
    }
    const roomMessages = this.#messages.get(roomId) ?? []
    roomMessages.push(message)
    this.#messages.set(roomId, roomMessages)
    return message
  }

  async reportPlayer(targetUserId: string, _roomId: StudyRoomId, _reason: StudyPlayerReportReason): Promise<void> {
    if (!targetUserId || targetUserId === this.#account.id) throw new StudyAdapterError('INVALID_REPORT_TARGET')
  }

  async startStudySession(): Promise<void> {
    this.#activeStudyStartedAt = this.#now()
  }

  async heartbeatStudySession(input: StudyHeartbeatInput): Promise<number> {
    return input.focused && input.foreground && this.#activeStudyStartedAt !== null ? 10 : 0
  }

  async finishStudySession(): Promise<StudyTimeSummary> {
    if (this.#activeStudyStartedAt !== null) {
      const seconds = Math.max(0, Math.floor((this.#now() - this.#activeStudyStartedAt) / 1_000))
      this.#summary = {
        todaySeconds: this.#summary.todaySeconds + seconds,
        monthSeconds: this.#summary.monthSeconds + seconds,
        totalSeconds: this.#summary.totalSeconds + seconds,
      }
      this.#activeStudyStartedAt = null
    }
    return { ...this.#summary }
  }

  async fetchSummary(): Promise<StudyTimeSummary> {
    return { ...this.#summary }
  }

  async fetchHome(): Promise<StudyHomeSnapshot> {
    const rooms = (['library', 'chim-alan', 'sports-center', 'auditorium', 'learning-lab'] as const).map((roomId) => {
      const instance = this.roomInstance(roomId)
      return { roomId, occupancy: instance.occupancy, capacity: instance.capacity, instanceCount: 1 }
    })
    const current = this.#account
    const ranking = (scale: number) => [
      { rank: 1, userId: 'preview-ece', displayName: 'Ece', studySeconds: 58_320 * scale, streakDays: 12, isCurrentUser: false },
      { rank: 2, userId: 'preview-mert', displayName: 'Mert', studySeconds: 51_840 * scale, streakDays: 9, isCurrentUser: false },
      { rank: 3, userId: 'preview-selin', displayName: 'Selin', studySeconds: 46_260 * scale, streakDays: 8, isCurrentUser: false },
      { rank: 4, userId: current.id, displayName: current.displayName, studySeconds: 39_900 * scale, streakDays: 6, isCurrentUser: true },
      { rank: 5, userId: 'preview-deniz', displayName: 'Deniz', studySeconds: 35_040 * scale, streakDays: 5, isCurrentUser: false },
    ]
    return {
      activePlayers: rooms.reduce((sum, room) => sum + room.occupancy, 0),
      summary: { ...this.#summary },
      rooms,
      leaderboard: { week: ranking(1), month: ranking(3), all: ranking(12) },
      generatedAt: new Date(this.#now()).toISOString(),
    }
  }

  async refreshPresence(roomId: StudyRoomId): Promise<readonly StudyPresence[]> {
    return this.presence(roomId)
  }

  async refreshChat(roomId: StudyRoomId): Promise<readonly StudyChatMessage[]> {
    return [...(this.#messages.get(roomId) ?? [])]
  }

  async heartbeatPresence(): Promise<void> {
    // The local adapter has no shared server; its deterministic actors remain static.
  }

  async listEvents(): Promise<readonly StudyWorldEvent[]> {
    return LOCAL_EVENTS.map((event) => ({ ...event, registered: this.#registeredEvents.has(event.id) }))
  }

  async registerEvent(eventId: string): Promise<StudyWorldEvent> {
    const event = LOCAL_EVENTS.find((candidate) => candidate.id === eventId)
    if (!event) throw new StudyAdapterError('EVENT_NOT_FOUND')
    this.#registeredEvents.add(eventId)
    return { ...event, registered: true }
  }

  async startPoolDive(): Promise<SocialArcadeSnapshot> {
    this.#poolDive = {
      id: globalThis.crypto.randomUUID(),
      round: 1,
      score: 0,
      prompt: 'center',
      nonce: globalThis.crypto.randomUUID().replaceAll('-', ''),
    }
    return {
      session: {
        ...this.#poolDive,
        status: 'active',
        totalRounds: 8,
        promptExpiresAt: new Date(this.#now() + 4_000).toISOString(),
        expiresAt: new Date(this.#now() + 120_000).toISOString(),
        final: false,
      },
      verification: 'local-preview',
    }
  }

  async playPoolDiveRound(
    sessionId: string,
    nonce: string,
    choice: SocialArcadeChoice,
  ): Promise<SocialArcadeSnapshot> {
    const session = this.#poolDive
    if (!session || session.id !== sessionId || session.nonce !== nonce) {
      throw new StudyAdapterError('SOCIAL_ARCADE_NONCE_INVALID')
    }
    const correct = choice === session.prompt
    const roundScore = correct ? 75 : 0
    session.score += roundScore
    const completedRound = session.round
    const final = completedRound >= 8
    if (!final) {
      session.round += 1
      session.prompt = session.prompt === 'left' ? 'center' : session.prompt === 'center' ? 'right' : 'left'
      session.nonce = globalThis.crypto.randomUUID().replaceAll('-', '')
    }
    return {
      result: { correct, validTiming: true, roundScore, elapsedMs: 500, completedRound },
      session: {
        id: session.id,
        status: final ? 'completed' : 'active',
        round: final ? 8 : session.round,
        totalRounds: 8,
        score: session.score,
        prompt: final ? null : session.prompt,
        nonce: final ? null : session.nonce,
        promptExpiresAt: final ? null : new Date(this.#now() + 4_000).toISOString(),
        expiresAt: final ? null : new Date(this.#now() + 120_000).toISOString(),
        final,
      },
      pointsAwarded: 0,
      spendablePoints: this.#globalPoints,
      verification: 'local-preview',
    }
  }
}
