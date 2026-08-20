import './styles.css'

import { ArrowRight, Armchair, BookOpen, CalendarDays, Check, Clock3, Coins, createIcons, EllipsisVertical, Flame, Hand, HelpCircle, Keyboard, LockKeyhole, LogIn, LogOut, Map, MapPin, MessageCircle, Monitor, Pause, Play, Radio, Send, Settings, ShieldCheck, Shirt, Sparkles, Star, Trophy, UserPlus, UserRound, UsersRound, Volume2, X } from 'lucide'
import { resolveStudyEntry, type StudyEntryConfig } from './account/StudyEntry'
import { isTeduEmailAddress, loginStudyAccount, registerStudyAccount, startStudyTeduLogin, verifyStudyAccountSession } from './account/StudyAuthClient'
import { createStudyWebBridge } from './account/StudyWebBridge'
import { LocalStudyAdapter } from './adapters/LocalStudyAdapter'
import { RadioTEDUStudyAdapter } from './adapters/RadioTEDUStudyAdapter'
import { StudyAdapterError, type StudyAccount, type StudyAdapter, type StudyChatMessage, type StudyHomeSnapshot, type StudyLeaderboardPeriod, type StudyPlayerReportReason, type StudyPresence, type StudyRoomId, type StudyRoomInstance, type StudySession, type StudyTimeSummary, type StudyWorldEvent } from './adapters/StudyAdapter'
import { createStudyGame } from './game/StudyGame'
import { IMAGE_ROOMS, type ImageRoomId } from './rooms/ImageRoomDefinition'
import { buildStudyPath } from './progression/StudyPathModel'
import { buildDailyFocusGoal } from './progression/DailyFocusGoal'
import { GOLD_STORE_ITEMS } from './inventory/GoldStoreCatalog'
import { studyGear } from './inventory/StudyGearStore'
import { IgnoredPlayerStore } from './safety/IgnoredPlayerStore'
import { StudySessionTracker, type StudySessionSnapshot, type StudySessionTransport } from './session/StudySessionTracker'
import { applyStudyRoomResponse } from './chat/StudyChatCoordinator'
import { CAMPUS_ROOM_CARDS, filterCampusRooms, type CampusRoomCategory } from './ui/CampusNavigatorModel'
import { HudPanelState, type HudPanelName } from './ui/HudPanelState'
import { formatRoomInstanceLabel } from './ui/RoomInstancePresentation'

const ui = document.querySelector<HTMLElement>('#game-ui')
if (!ui) throw new Error('Study game UI root is missing')

const parameters = new URLSearchParams(window.location.search)
const mode = import.meta.env.DEV && parameters.get('scene') === 'engine-proof' ? 'engine-proof' : 'study'
const requestedRoom = parameters.get('room')
const initialRoom: ImageRoomId = requestedRoom && requestedRoom in IMAGE_ROOMS ? requestedRoom as ImageRoomId : 'library'
document.documentElement.dataset.roomId = initialRoom
const secureBridge = readSecureBridge()
const entry = resolveStudyEntry(window.RadioTEDUStudyEntry, window.location)
const isHostedProduction = import.meta.env.PROD && window.location.protocol !== 'file:'
const STUDY_RADIO_STREAM_URL = 'https://stream.radiotedu.com/radio?q=medium'
type ActiveStudyBridge = Readonly<{
  apiBase: string
  fetchImpl: typeof fetch
  account: StudyAccount
  globalPoints?: number
}>
const ROOM_SUMMARIES: Readonly<Record<StudyRoomId, string>> = Object.freeze({
  library: 'Quiet study · focus seats',
  'chim-alan': 'Open campus · social seating',
  'sports-center': 'Training · team activities',
  auditorium: 'Talks · live campus events',
  'learning-lab': 'Creative learning · reading cushions',
})

if (isHostedProduction && !secureBridge) {
  void bootStudyFromWebSession(entry)
} else if (mode === 'engine-proof') {
  renderEngineProof()
  createStudyGame('game-canvas', mode, new LocalStudyAdapter(), initialRoom)
} else {
  void bootStudy(secureBridge, entry)
}

async function bootStudyFromWebSession(entryConfig: ReturnType<typeof resolveStudyEntry>): Promise<void> {
  try {
    const session = await verifyStudyAccountSession()
    await bootStudy(createStudyWebBridge(session, window.location), entryConfig)
  } catch {
    renderLockedStudy(entryConfig)
  }
}

async function bootStudy(secureBridge: ActiveStudyBridge | null, entryConfig: ReturnType<typeof resolveStudyEntry>) {
  const adapter: StudyAdapter = secureBridge
    ? new RadioTEDUStudyAdapter(secureBridge)
    : createLocalAdapter()

  try {
    await adapter.initialize?.()
  } catch {
    renderUnavailableStudy()
    return
  }

  const session = adapter.session()
  let worldStarted = false
  const launchWorld = (roomId: ImageRoomId) => {
    if (worldStarted) return
    worldStarted = true
    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.delete('view')
    nextUrl.searchParams.set('room', roomId)
    window.history.replaceState({}, '', nextUrl)
    document.documentElement.dataset.roomId = roomId
    renderStudyShell(session, Boolean(secureBridge), entryConfig)

    const tracker = createSessionTracker(adapter)
    const panels = bindPanels()
    bindGoldShop(adapter, session, tracker, panels)
    bindComputerShop(adapter, secureBridge)
    const safety = new IgnoredPlayerStore(window.localStorage)
    bindRoomInstance(adapter, roomId)
    bindRoomArrival(roomId)
    bindCampusNavigator(adapter, panels)
    bindChat(adapter, safety)
    bindPresence(adapter, panels, safety)
    bindEvents(adapter, panels)
    bindStudyPath(tracker, roomId)
    bindAttention(tracker)
    bindStudyClock(tracker, adapter)
    bindRadioPlayer()
    bindGlobalShortcuts(panels)

    createStudyGame('game-canvas', mode, adapter, roomId, tracker)
  }

  const wantsHome = parameters.get('view') === 'home' || (Boolean(secureBridge) && !parameters.has('room'))
  if (wantsHome) {
    await renderStudyHome(adapter, session, Boolean(secureBridge), entryConfig, launchWorld)
    return
  }
  launchWorld(initialRoom)
}

async function renderStudyHome(
  adapter: StudyAdapter,
  session: StudySession,
  serverAuthoritative: boolean,
  entryConfig: ReturnType<typeof resolveStudyEntry>,
  launchWorld: (roomId: ImageRoomId) => void,
) {
  const [homeResult, eventsResult] = await Promise.allSettled([
    adapter.fetchHome?.() ?? Promise.reject(new StudyAdapterError('HOME_UNAVAILABLE')),
    adapter.listEvents?.() ?? Promise.resolve([]),
  ])
  const degraded = homeResult.status === 'rejected'
  const snapshot = homeResult.status === 'fulfilled'
    ? homeResult.value
    : fallbackHomeSnapshot(adapter, session)
  const events = eventsResult.status === 'fulfilled' ? eventsResult.value : []
  document.documentElement.dataset.studyAuthority = serverAuthoritative ? 'verified' : 'local'
  document.documentElement.dataset.studyReady = 'home'
  document.documentElement.dataset.homeData = degraded ? 'degraded' : serverAuthoritative ? 'live' : 'local'
  ui!.innerHTML = `
    <section class="study-home" data-testid="study-home">
      <header class="home-topbar">
        <a class="home-brand" href="?view=home" aria-label="RadioTEDU Study home"><span><i data-lucide="radio" aria-hidden="true"></i></span><b><strong>RadioTEDU</strong><small>STUDY</small></b></a>
        <nav aria-label="Study home sections"><a href="#home-rooms">Rooms</a><a href="#home-ranking">Ranking</a><a href="#home-events">Events</a></nav>
        <div class="home-account-summary"><span class="home-gold"><i data-lucide="coins" aria-hidden="true"></i><b id="home-gold"></b><small>Gold</small></span><a href="${entryConfig.accountUrl}" target="_top"><span id="home-account-avatar" aria-hidden="true"></span><b id="home-account-name"></b><i data-lucide="settings" aria-hidden="true"></i></a></div>
      </header>
      <main>
        <section class="home-hero" aria-labelledby="home-title">
          <img src="assets/rooms/library-wide.png" alt="" />
          <span class="home-hero-shade"></span>
          <div class="home-hero-copy">
            <p><i></i><span id="home-live-count"></span> students live on campus</p>
            <h1 id="home-title">Your campus.<br />Your focus room.</h1>
            <span>Meet friends, choose a desk, listen live and build your verified study streak.</span>
            <div><button id="home-enter-primary" type="button"><i data-lucide="book-open" aria-hidden="true"></i><b>Enter Library</b><small>Continue studying</small><i data-lucide="arrow-right" aria-hidden="true"></i></button><a href="#home-rooms"><i data-lucide="map" aria-hidden="true"></i>Explore rooms</a></div>
          </div>
          <aside class="home-focus-card" aria-label="Your study progress">
            <span><i data-lucide="clock-3" aria-hidden="true"></i><small>TODAY</small><strong id="home-today-time"></strong></span>
            <span><i data-lucide="flame" aria-hidden="true"></i><small>THIS MONTH</small><strong id="home-month-time"></strong></span>
            <b>${serverAuthoritative ? '<i data-lucide="shield-check" aria-hidden="true"></i> Server verified' : '<i data-lucide="shield-check" aria-hidden="true"></i> Session ready'}</b>
          </aside>
        </section>
        <section class="home-status-strip" aria-label="Campus status">
          <span><i data-lucide="users-round" aria-hidden="true"></i><b id="home-active-players"></b><small>Students online</small></span>
          <span><i data-lucide="map-pin" aria-hidden="true"></i><b>${CAMPUS_ROOM_CARDS.length}</b><small>Campus rooms</small></span>
          <span><i data-lucide="trophy" aria-hidden="true"></i><b>Weekly</b><small>Study ranking</small></span>
          <span data-home-health="${degraded ? 'degraded' : 'ready'}"><i data-lucide="${degraded ? 'lock-keyhole' : 'shield-check'}" aria-hidden="true"></i><b>${degraded ? 'Game available' : serverAuthoritative ? 'Live data' : 'Campus open'}</b><small>${degraded ? 'Ranking temporarily unavailable' : 'Updated securely'}</small></span>
        </section>
        <div class="home-dashboard-grid">
          <section id="home-rooms" class="home-panel home-rooms-panel">
            <header><span><small>TEDU CAMPUS</small><h2>Choose a place</h2></span><b><i></i> LIVE ROOMS</b></header>
            <div id="home-room-list" class="home-room-list"></div>
          </section>
          <section id="home-ranking" class="home-panel home-ranking-panel" data-testid="home-leaderboard">
            <header><span><small>STUDY LEAGUE</small><h2>Leaderboard</h2></span><i data-lucide="trophy" aria-hidden="true"></i></header>
            <nav aria-label="Leaderboard period"><button type="button" data-home-period="week" aria-pressed="true">This week</button><button type="button" data-home-period="month" aria-pressed="false">Month</button><button type="button" data-home-period="all" aria-pressed="false">All time</button></nav>
            <ol id="home-ranking-list" class="home-ranking-list" aria-live="polite"></ol>
            <footer><i data-lucide="shield-check" aria-hidden="true"></i><span>Only server-verified focus time counts.</span></footer>
          </section>
          <section id="home-events" class="home-panel home-events-panel">
            <header><span><small>WHAT'S HAPPENING</small><h2>Campus events</h2></span><i data-lucide="calendar-days" aria-hidden="true"></i></header>
            <div id="home-event-list" class="home-event-list"></div>
            <button id="home-enter-events" type="button"><i data-lucide="map-pin" aria-hidden="true"></i><span><b>Visit the Auditorium</b><small>Talks, broadcasts and group sessions</small></span><i data-lucide="arrow-right" aria-hidden="true"></i></button>
          </section>
        </div>
      </main>
      <footer class="home-footer"><span>RadioTEDU Study</span><b>Be kind · Study honestly · Help keep campus safe</b><a href="${entryConfig.helpUrl}" target="_top">Help &amp; safety</a></footer>
    </section>
  `

  document.querySelector('#home-account-name')!.textContent = session.account.displayName
  document.querySelector('#home-account-avatar')!.textContent = session.account.displayName.trim().slice(0, 1).toUpperCase() || 'R'
  document.querySelector('#home-gold')!.textContent = String(session.points.global)
  document.querySelector('#home-live-count')!.textContent = String(snapshot.activePlayers)
  document.querySelector('#home-active-players')!.textContent = String(snapshot.activePlayers)
  document.querySelector('#home-today-time')!.textContent = formatHomeDuration(snapshot.summary.todaySeconds)
  document.querySelector('#home-month-time')!.textContent = formatHomeDuration(snapshot.summary.monthSeconds)

  const roomList = document.querySelector<HTMLElement>('#home-room-list')!
  for (const card of CAMPUS_ROOM_CARDS) {
    const overview = snapshot.rooms.find((room) => room.roomId === card.id)
    const roomButton = document.createElement('button')
    roomButton.type = 'button'
    roomButton.className = 'home-room-card'
    roomButton.dataset.roomId = card.id
    const image = document.createElement('img')
    image.src = card.imageUrl
    image.alt = ''
    const shade = document.createElement('span')
    shade.className = 'home-room-card-shade'
    const copy = document.createElement('span')
    copy.className = 'home-room-card-copy'
    const title = document.createElement('strong')
    title.textContent = card.title
    const description = document.createElement('small')
    description.textContent = card.description
    const population = document.createElement('b')
    population.textContent = overview ? `${overview.occupancy}/${overview.capacity} online` : 'Open room'
    copy.append(title, description, population)
    const arrow = document.createElement('i')
    arrow.dataset.lucide = 'arrow-right'
    arrow.setAttribute('aria-hidden', 'true')
    roomButton.append(image, shade, copy, arrow)
    roomButton.addEventListener('click', () => launchWorld(card.id))
    roomList.append(roomButton)
  }

  const renderRanking = (period: StudyLeaderboardPeriod) => {
    const list = document.querySelector<HTMLOListElement>('#home-ranking-list')!
    list.replaceChildren()
    const entries = snapshot.leaderboard[period].slice(0, 10)
    if (entries.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'home-ranking-empty'
      empty.textContent = degraded ? 'Live ranking is temporarily unavailable.' : 'No verified study time yet.'
      list.append(empty)
      return
    }
    for (const entry of entries) {
      const item = document.createElement('li')
      if (entry.isCurrentUser) item.dataset.currentUser = 'true'
      const rank = document.createElement('b')
      rank.textContent = String(entry.rank)
      const avatar = document.createElement('span')
      avatar.textContent = entry.displayName.trim().slice(0, 1).toUpperCase() || 'R'
      const identity = document.createElement('span')
      const name = document.createElement('strong')
      name.textContent = entry.displayName
      const streak = document.createElement('small')
      streak.textContent = `${entry.streakDays} day streak`
      identity.append(name, streak)
      const duration = document.createElement('em')
      duration.textContent = formatHomeDuration(entry.studySeconds)
      item.append(rank, avatar, identity, duration)
      list.append(item)
    }
  }
  document.querySelectorAll<HTMLButtonElement>('[data-home-period]').forEach((button) => {
    button.addEventListener('click', () => {
      const period = button.dataset.homePeriod as StudyLeaderboardPeriod
      document.querySelectorAll<HTMLButtonElement>('[data-home-period]').forEach((candidate) => { candidate.ariaPressed = String(candidate === button) })
      renderRanking(period)
    })
  })
  renderRanking('week')

  const eventList = document.querySelector<HTMLElement>('#home-event-list')!
  for (const worldEvent of events.filter((event) => event.status !== 'completed').slice(0, 3)) {
    const article = document.createElement('article')
    const icon = document.createElement('span')
    icon.innerHTML = '<i data-lucide="star" aria-hidden="true"></i>'
    const copy = document.createElement('span')
    const title = document.createElement('strong')
    title.textContent = worldEvent.title
    const location = document.createElement('small')
    location.textContent = worldEvent.location
    copy.append(title, location)
    const reward = document.createElement('b')
    reward.textContent = `+${worldEvent.rewardGold} Gold`
    article.append(icon, copy, reward)
    eventList.append(article)
  }
  if (!eventList.childElementCount) {
    const empty = document.createElement('p')
    empty.textContent = 'No campus events are scheduled yet.'
    eventList.append(empty)
  }

  document.querySelector<HTMLButtonElement>('#home-enter-primary')!.addEventListener('click', () => launchWorld('library'))
  document.querySelector<HTMLButtonElement>('#home-enter-events')!.addEventListener('click', () => launchWorld('auditorium'))
  createIcons({ icons: { ArrowRight, BookOpen, CalendarDays, Clock3, Coins, Flame, LockKeyhole, Map, MapPin, Radio, Settings, ShieldCheck, Star, Trophy, UsersRound } })
}

function fallbackHomeSnapshot(adapter: StudyAdapter, session: StudySession): StudyHomeSnapshot {
  const capacities: Readonly<Record<StudyRoomId, number>> = Object.freeze({
    library: 51, 'chim-alan': 9, 'sports-center': 18, auditorium: 90, 'learning-lab': 24,
  })
  const rooms = CAMPUS_ROOM_CARDS.map((card) => {
    const instance = adapter.roomInstance?.(card.id)
    return { roomId: card.id, occupancy: instance?.occupancy ?? 0, capacity: instance?.capacity ?? capacities[card.id], instanceCount: 1 }
  })
  return {
    activePlayers: rooms.reduce((sum, room) => sum + room.occupancy, 0),
    summary: { todaySeconds: session.points.studyToday * 60, monthSeconds: 0, totalSeconds: 0 },
    rooms,
    leaderboard: { week: [], month: [], all: [] },
    generatedAt: null,
  }
}

function formatHomeDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`
}

function renderEngineProof() {
  ui!.innerHTML = `
    <header class="game-brand" aria-label="RadioTEDU Study"><strong>RadioTEDU</strong><span>STUDY</span></header>
    <output id="game-status" class="game-status" data-state="loading" aria-live="polite">LOADING</output>
    <nav class="game-controls" aria-label="Engine proof controls">
      <button id="run-proof" class="icon-button" type="button" aria-label="Run movement proof" title="Run movement proof">▶</button>
      <button id="sit-toggle" class="icon-button" type="button" aria-label="Sit or stand" title="Sit or stand">↕</button>
    </nav>
  `
}

function renderStudyShell(session: StudySession, serverAuthoritative: boolean, entryConfig: ReturnType<typeof resolveStudyEntry>) {
  document.documentElement.dataset.studyAuthority = serverAuthoritative ? 'verified' : 'local'
  ui!.innerHTML = `
    <header class="study-bar" data-study-ui>
      <div class="study-brand" aria-label="RadioTEDU Study"><span class="brand-mark"><i data-lucide="radio" aria-hidden="true"></i></span><span class="brand-copy"><strong>RadioTEDU</strong><small>STUDY</small></span></div>
      <div class="room-context"><span><i data-lucide="map-pin" aria-hidden="true"></i><small>ROOM</small></span><strong id="room-title" class="room-title">Library</strong><output id="room-instance" class="room-instance" aria-label="Room instance" aria-live="polite">Connecting…</output></div>
      <output id="game-status" class="game-status" data-state="loading" aria-live="polite">LOADING</output>
      <section class="study-clock" data-testid="study-summary" aria-label="Study time">
        <span class="focus-icon"><i data-lucide="book-open" aria-hidden="true"></i></span>
        <span class="focus-copy"><small id="study-phase">FOCUS READY</small><strong id="study-timer" data-testid="study-timer" data-running="false">00:00:00</strong></span>
        <span class="focus-metric"><b id="study-today">0m</b><small>Today</small></span>
        <span class="focus-metric"><b id="study-month">0m</b><small>Month</small></span>
      </section>
      <section class="radio-mini" data-testid="radio-player" data-playing="false" aria-label="RadioTEDU player">
        <button id="radio-toggle" class="radio-toggle" type="button" aria-label="Play RadioTEDU" aria-pressed="false">
          <i class="radio-play-icon" data-lucide="play" aria-hidden="true"></i>
          <i class="radio-pause-icon" data-lucide="pause" aria-hidden="true"></i>
        </button>
        <span class="radio-copy"><small><i></i> LIVE RADIO</small><strong>RadioTEDU</strong><b id="radio-status">Main Channel · Ready</b></span>
        <span class="radio-level" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <i class="radio-volume" data-lucide="volume-2" aria-hidden="true"></i>
      </section>
      <div class="authority-chip" data-authority="verified" aria-label="${serverAuthoritative ? 'Server verified session' : 'Campus connection open'}"><i data-lucide="shield-check" aria-hidden="true"></i><span><small>${serverAuthoritative ? 'VERIFIED' : 'CAMPUS'}</small><b>${serverAuthoritative ? 'Server session' : 'OPEN'}</b></span></div>
      <div class="point-balance" role="status" aria-live="polite" aria-label="Gold balance"><i data-lucide="coins" aria-hidden="true"></i><span><small>GOLD</small><strong id="point-balance"></strong></span><span>Gold</span></div>
      <output id="gold-toast" class="gold-toast" role="status" aria-live="polite" hidden></output>
    <button id="account-toggle" class="account-chip" data-hud-toggle="account" type="button" aria-label="Open signed-in account" aria-expanded="false" aria-controls="account-panel"><span id="account-avatar" class="account-avatar" aria-hidden="true"></span><span><small>ONLINE</small><strong id="account-name"></strong></span><i class="account-menu-icon" data-lucide="ellipsis-vertical" aria-hidden="true"></i></button>
    </header>
    <aside id="room-arrival" class="room-arrival" data-study-ui aria-live="polite" hidden>
      <span class="room-arrival-icon"><i data-lucide="map-pin" aria-hidden="true"></i></span>
      <span><small>NOW ENTERING</small><strong id="room-arrival-title">Library</strong><b id="room-arrival-copy">Quiet study · focus seats</b></span>
    </aside>
    <nav class="action-dock" data-study-ui aria-label="Game actions">
      <button id="navigator-toggle" data-hud-toggle="navigator" data-testid="navigator-toggle" class="dock-button" type="button" aria-label="Campus" aria-expanded="false" aria-controls="navigator-panel"><span class="dock-icon"><i data-lucide="map" aria-hidden="true"></i></span><span class="button-label">Campus</span></button>
      <button id="chat-toggle" data-hud-toggle="chat" class="dock-button" type="button" aria-label="Chat" aria-expanded="false" aria-controls="chat-panel"><span class="dock-icon"><i data-lucide="message-circle" aria-hidden="true"></i></span><span class="button-label">Chat</span><strong id="chat-unread" class="dock-badge" hidden>0</strong></button>
      <button id="people-toggle" data-hud-toggle="people" data-testid="people-toggle" class="dock-button" type="button" aria-label="People" aria-expanded="false" aria-controls="presence-panel"><span class="dock-icon"><i data-lucide="users-round" aria-hidden="true"></i></span><span class="button-label">People</span><strong id="people-count" class="dock-badge">0</strong></button>
      <button id="wardrobe-toggle" data-hud-toggle="wardrobe" data-testid="wardrobe-toggle" class="dock-button" type="button" aria-label="Wardrobe" aria-expanded="false" aria-controls="wardrobe-panel"><span class="dock-icon"><i data-lucide="shirt" aria-hidden="true"></i></span><span class="button-label">Wardrobe</span></button>
      <button id="shop-toggle" data-hud-toggle="shop" data-testid="shop-toggle" class="dock-button" type="button" aria-label="Campus Shop" aria-expanded="false" aria-controls="shop-panel"><span class="dock-icon"><i data-lucide="coins" aria-hidden="true"></i></span><span class="button-label">Shop</span></button>
      <button id="events-toggle" data-hud-toggle="events" data-testid="events-toggle" class="dock-button" type="button" aria-label="Events" aria-expanded="false" aria-controls="events-panel"><span class="dock-icon"><i data-lucide="calendar-days" aria-hidden="true"></i></span><span class="button-label">Events</span><strong id="event-count" class="dock-badge">0</strong></button>
    </nav>
    <aside class="world-rail" data-study-ui aria-label="Campus navigator">
      <div class="rail-heading"><span class="rail-heading-icon"><i data-lucide="map" aria-hidden="true"></i></span><span><small>TEDU</small><strong>Places</strong></span><b>LIVE</b></div>
      <nav class="room-tabs" role="tablist" aria-label="Study rooms">
        <button type="button" role="tab" data-room-id="library" aria-selected="true"><span class="room-icon"><i data-lucide="book-open" aria-hidden="true"></i></span><span>Library<small>Quiet study · 3 online</small></span></button>
        <button type="button" role="tab" data-room-id="chim-alan" aria-label="Çim Alan" aria-selected="false"><span class="room-icon"><i data-lucide="sparkles" aria-hidden="true"></i></span><span>Çim Alan<small>Outdoor campus</small></span></button>
        <button type="button" role="tab" data-room-id="sports-center" aria-label="Sports Center" aria-selected="false"><span class="room-icon"><i data-lucide="star" aria-hidden="true"></i></span><span>Sports Center<small>Train together</small></span></button>
        <button type="button" role="tab" data-room-id="auditorium" aria-label="Auditorium" aria-selected="false"><span class="room-icon"><i data-lucide="users-round" aria-hidden="true"></i></span><span>Auditorium<small>Group sessions</small></span></button>
        <button type="button" role="tab" data-room-id="learning-lab" aria-label="Learning Lab" aria-selected="false"><span class="room-icon"><i data-lucide="book-open" aria-hidden="true"></i></span><span>Learning Lab<small>Creative study</small></span></button>
      </nav>
      <section id="study-mission" class="study-mission" data-testid="study-mission" aria-live="polite">
        <span class="mission-icon"><i data-lucide="armchair" aria-hidden="true"></i></span>
        <span class="mission-copy"><small id="study-mission-kicker">DAILY FOCUS GOAL</small><strong id="study-mission-title">Earn Gold with verified focus</strong><b id="study-mission-copy">Sit in any study seat. Earn up to 25 Gold per day across Study and Pomodoro.</b><span class="mission-meta"><b id="study-mission-meter">0/25 MIN</b><b id="study-mission-reward">UP TO 25 GOLD</b></span><span id="study-mission-progress" class="mission-progress" role="progressbar" aria-label="Daily verified focus progress" aria-valuemin="0" aria-valuemax="25" aria-valuenow="0"><i></i></span></span>
      </section>
      <button type="button" class="rail-briefing" aria-label="Open next campus event" data-hud-toggle="events">
        <small>UP NEXT</small>
        <strong id="next-event-title">Loading events…</strong>
        <span id="next-event-location">TEDU Campus</span>
        <b><i data-lucide="star" aria-hidden="true"></i><span id="next-event-reward">Gold reward</span></b>
      </button>
      <div class="desktop-controls"><i data-lucide="keyboard" aria-hidden="true"></i><span><strong>PC controls</strong><small>Click or WASD to walk · Enter to chat · Esc to close</small></span></div>
    </aside>
    <aside id="navigator-panel" class="hud-sheet navigator-panel" data-hud-panel="navigator" data-study-ui aria-label="Campus navigator" hidden>
      <header><span class="panel-heading"><i data-lucide="map" aria-hidden="true"></i><span><small>TEDU CAMPUS</small><strong>Navigator</strong></span></span><button data-hud-close class="close-button" type="button" aria-label="Close campus navigator"><i data-lucide="x" aria-hidden="true"></i></button></header>
      <p class="panel-intro">Find a place by activity, see the current room, and move without losing radio playback.</p>
      <label class="navigator-search"><span>Search places</span><input id="navigator-search" type="search" autocomplete="off" placeholder="Library, events, social…" /></label>
      <nav class="navigator-filters" aria-label="Room categories">
        <button type="button" data-room-category="all" aria-pressed="true">All</button>
        <button type="button" data-room-category="study" aria-pressed="false">Study</button>
        <button type="button" data-room-category="social" aria-pressed="false">Social</button>
        <button type="button" data-room-category="activity" aria-pressed="false">Activity</button>
        <button type="button" data-room-category="events" aria-pressed="false">Events</button>
      </nav>
      <div id="navigator-room-list" class="navigator-room-list" data-testid="navigator-room-list"></div>
    </aside>
    <aside id="presence-panel" class="hud-sheet presence-panel" data-hud-panel="people" data-study-ui aria-label="People in this room" hidden>
      <header><span class="panel-heading"><i data-lucide="users-round" aria-hidden="true"></i><span><small>THIS ROOM</small><strong>People</strong></span></span><button id="presence-close" data-hud-close class="close-button" type="button" aria-label="Close people panel"><i data-lucide="x" aria-hidden="true"></i></button></header>
      <p class="panel-intro">See who is here, who is focusing, and send a friendly wave.</p>
      <div id="player-list" class="player-list"></div>
    </aside>
    <aside id="events-panel" class="hud-sheet events-panel" data-hud-panel="events" data-study-ui aria-label="Campus events" hidden>
      <header><span><small>TEDU CAMPUS</small><strong id="events-panel-title">Events</strong></span><button id="events-close" data-hud-close class="close-button" type="button" aria-label="Close events"><i data-lucide="x" aria-hidden="true"></i></button></header>
      <nav class="events-view-tabs" aria-label="Events and study path"><button type="button" data-events-view="events" aria-selected="true">Campus Events</button><button type="button" data-events-view="path" aria-selected="false">Study Path</button></nav>
      <p id="events-panel-intro" class="panel-intro">Join campus actions with your RadioTEDU account. Gold is awarded only after server verification.</p>
      <div id="event-list" class="event-list" data-testid="event-list" aria-live="polite"></div>
      <div id="study-path-list" class="study-path-list" data-testid="study-path-list" aria-live="polite" hidden></div>
      <footer><i data-lucide="check" aria-hidden="true"></i><span>Use the RadioTEDU mobile app for QR check-in and verified rewards.</span></footer>
    </aside>
    <aside id="wardrobe-panel" class="hud-sheet wardrobe-panel" data-hud-panel="wardrobe" data-study-ui aria-label="Wardrobe" hidden>
      <header><strong>Wardrobe</strong><button id="wardrobe-close" data-hud-close class="close-button" type="button" aria-label="Close wardrobe"><i data-lucide="x" aria-hidden="true"></i></button></header>
      <div class="wardrobe-preview">
        <div id="wardrobe-avatar-preview" class="avatar-preview-stack" aria-label="Current outfit">
          <span data-avatar-preview-layer="body"></span><span data-avatar-preview-layer="skin"></span><span data-avatar-preview-layer="hair"></span><span data-avatar-preview-layer="top"></span><span data-avatar-preview-layer="bottom"></span><span data-avatar-preview-layer="shoes"></span><span data-avatar-preview-layer="hat"></span>
        </div>
        <span><small>YOUR LOOK</small><strong id="wardrobe-look-name">Campus Classic</strong><b>Ready to wear</b></span>
      </div>
      <section><h2>Top</h2><div class="wearable-grid">
        <button data-testid="wearable-radio-hoodie" data-slot="top" data-wearable-id="radio-hoodie" type="button"><i class="swatch swatch-teal"></i><span>Radio Hoodie<small>Included</small></span></button>
        <button data-testid="wearable-varsity-jacket" data-slot="top" data-wearable-id="varsity-jacket" type="button"><i class="swatch swatch-red"></i><span>Varsity<small>80 Gold</small></span></button>
      </div></section>
      <section><h2>Bottom</h2><div class="wearable-grid">
        <button data-testid="wearable-jeans" data-slot="bottom" data-wearable-id="jeans" type="button"><i class="swatch swatch-blue"></i><span>Jeans<small>Included</small></span></button>
        <button data-testid="wearable-black-cargos" data-slot="bottom" data-wearable-id="black-cargos" type="button"><i class="swatch swatch-black"></i><span>Black Cargos<small>60 Gold</small></span></button>
      </div></section>
      <section><h2>Shoes</h2><div class="wearable-grid">
        <button data-testid="wearable-sneakers" data-slot="shoes" data-wearable-id="sneakers" type="button"><i class="swatch swatch-ivory"></i><span>Sneakers<small>Included</small></span></button>
        <button data-testid="wearable-boots" data-slot="shoes" data-wearable-id="boots" type="button"><i class="swatch swatch-black"></i><span>Boots<small>50 Gold</small></span></button>
      </div></section>
      <section><h2>Hat</h2><div class="wearable-grid">
        <button data-testid="wearable-bucket-hat" data-slot="hat" data-wearable-id="bucket-hat" type="button"><i class="swatch swatch-gold"></i><span>Bucket Hat<small>Included</small></span></button>
        <button data-testid="wearable-beanie" data-slot="hat" data-wearable-id="beanie" type="button"><i class="swatch swatch-plum"></i><span>Beanie<small>35 Gold</small></span></button>
      </div></section>
    </aside>
    <aside id="shop-panel" class="hud-sheet gear-panel" data-hud-panel="shop" data-study-ui aria-label="Campus Shop" hidden>
      <header><span class="panel-heading"><i data-lucide="coins" aria-hidden="true"></i><span><small>CAMPUS STORE</small><strong>Gold style shop</strong></span></span><button data-hud-close class="close-button" type="button" aria-label="Close Campus Shop"><i data-lucide="x" aria-hidden="true"></i></button></header>
      <p class="panel-intro">Spend server-verified Gold on complete avatar styles that work while walking and sitting.</p>
      <section class="gold-economy" aria-label="Gold progress">
        <span><small>AVAILABLE</small><strong><b id="shop-gold-balance">0</b> Gold</strong></span>
        <span><small>DAILY STUDY</small><strong id="shop-gold-daily">0/25 verified min</strong></span>
        <span id="shop-gold-progress" class="gold-progress" role="progressbar" aria-label="Daily Study Gold progress" aria-valuemin="0" aria-valuemax="25" aria-valuenow="0"><i></i></span>
        <b id="shop-next-unlock" class="shop-next-unlock">Next style unlock loading…</b>
      </section>
      <div id="gear-grid" class="gear-grid" data-testid="gold-store-grid"></div>
      <section class="computer-store" aria-labelledby="computer-store-title">
        <header><span><small>STUDY SETUP</small><strong id="computer-store-title">Computers</strong></span><i data-lucide="monitor" aria-hidden="true"></i></header>
        <p>Buy once with your shared RadioTEDU Gold, then equip it in Study.</p>
        <div id="computer-grid" class="computer-grid" aria-live="polite"></div>
      </section>
      <output id="gear-message" class="gear-message" aria-live="polite">1 Gold per verified minute · 25 Gold daily cap shared with Pomodoro.</output>
    </aside>
    <aside id="player-card" class="hud-sheet player-card" data-hud-panel="profile" data-study-ui data-testid="player-card" aria-label="Player" hidden>
      <button id="player-card-close" data-hud-close class="close-button" type="button" aria-label="Close player"><i data-lucide="x" aria-hidden="true"></i></button>
      <span class="player-card-avatar" aria-hidden="true"></span>
      <strong id="player-card-name"></strong>
      <small id="player-card-status">Studying</small>
      <div class="player-card-actions"><button id="player-wave" data-testid="player-wave" class="command-button" type="button"><i data-lucide="hand" aria-hidden="true"></i><span>Wave</span></button><button id="player-ignore" data-testid="player-ignore" class="command-button secondary" type="button">Ignore</button><button id="player-report" data-testid="player-report" class="command-button danger" type="button">Report</button></div>
      <form id="player-report-controls" class="player-report-controls" hidden><label>Reason<select id="player-report-reason"><option value="harassment">Harassment</option><option value="spam">Spam</option><option value="unsafe-profile">Unsafe profile</option><option value="other">Other</option></select></label><div><button type="button" id="player-report-cancel">Cancel</button><button type="submit">Send report</button></div></form>
    </aside>
    <aside id="chat-panel" class="hud-sheet chat-dock" data-hud-panel="chat" data-study-ui aria-label="Room chat" hidden>
      <header><span class="panel-heading"><i data-lucide="message-circle" aria-hidden="true"></i><span><small id="chat-room-label">LIBRARY · ROOM 1</small><strong>Room Chat</strong></span></span><span id="chat-connection" class="live-pill"><i></i> LIVE</span><button id="chat-close" data-hud-close class="close-button" type="button" aria-label="Close chat"><i data-lucide="x" aria-hidden="true"></i></button></header>
      <div id="chat-log" data-testid="chat-log" class="chat-log" role="log" aria-live="polite" aria-relevant="additions"><div class="chat-empty"><i data-lucide="message-circle" aria-hidden="true"></i><strong>No messages yet</strong><span>Chat with people in this room.</span></div></div>
      <div class="chat-reactions" aria-label="Quick reactions"><button type="button" data-chat-reaction="👋">👋 <span>Wave</span></button><button type="button" data-chat-reaction="📚">📚 <span>Study</span></button><button type="button" data-chat-reaction="☕">☕ <span>Break</span></button></div>
      <div id="chat-feedback" class="chat-feedback" role="status" aria-live="polite">Be kind · No spam · Room chat</div>
      <form id="chat-form"><span class="chat-input-wrap"><input id="chat-input" maxlength="180" autocomplete="off" placeholder="Message this room…" aria-label="Chat message" /><small id="chat-counter">0/180</small></span><button type="submit" aria-label="Send message" title="Send message"><i data-lucide="send" aria-hidden="true"></i><span class="button-label">Send</span></button></form>
    </aside>
    <aside id="account-panel" class="hud-sheet account-panel" data-hud-panel="account" data-study-ui aria-label="Your RadioTEDU account" hidden>
      <header><span class="panel-heading"><i data-lucide="user-round" aria-hidden="true"></i><span><small>RADIOTEDU ACCOUNT</small><strong>Your profile</strong></span></span><button data-hud-close class="close-button" type="button" aria-label="Close account panel"><i data-lucide="x" aria-hidden="true"></i></button></header>
      <div class="account-panel-hero"><span id="account-panel-avatar" class="account-avatar" aria-hidden="true"></span><span><small>SIGNED IN</small><strong id="account-panel-name"></strong><b>${serverAuthoritative ? 'Verified server session' : 'Campus player'}</b></span></div>
      <div class="account-security" data-state="verified"><i data-lucide="shield-check" aria-hidden="true"></i><span><strong>Account protected</strong><small>${serverAuthoritative ? 'Identity, Gold and inventory are verified by RadioTEDU servers.' : 'Your local gear stays in this browser.'}</small></span></div>
      <nav class="account-actions" aria-label="Account actions">
        <a href="${entryConfig.accountUrl}" target="_top"><i data-lucide="settings" aria-hidden="true"></i><span><strong>Account settings</strong><small>Profile, password and security</small></span></a>
        <a href="${entryConfig.helpUrl}" target="_top"><i data-lucide="help-circle" aria-hidden="true"></i><span><strong>Help & safety</strong><small>Community rules and support</small></span></a>
        <a class="account-sign-out" href="${entryConfig.logoutUrl}" target="_top"><i data-lucide="log-out" aria-hidden="true"></i><span><strong>Sign out</strong><small>End this RadioTEDU session</small></span></a>
      </nav>
    </aside>
  `
  createIcons({ icons: { Armchair, BookOpen, CalendarDays, Check, Coins, EllipsisVertical, Hand, HelpCircle, Keyboard, LockKeyhole, LogIn, LogOut, Map, MapPin, MessageCircle, Monitor, Pause, Play, Radio, Send, Settings, ShieldCheck, Shirt, Sparkles, Star, UserPlus, UserRound, UsersRound, Volume2, X } })
  document.querySelector('#account-name')!.textContent = session.account.displayName
  document.querySelector('#account-avatar')!.textContent = session.account.displayName.trim().slice(0, 1).toUpperCase() || 'R'
  document.querySelector('#account-panel-name')!.textContent = session.account.displayName
  document.querySelector('#account-panel-avatar')!.textContent = session.account.displayName.trim().slice(0, 1).toUpperCase() || 'R'
  document.querySelector('#point-balance')!.textContent = String(session.points.global)
}

function renderLockedStudy(entryConfig: ReturnType<typeof resolveStudyEntry>) {
  ui!.innerHTML = `
    <section class="study-gate" aria-labelledby="study-entry-title">
      <div class="study-entry-room" aria-hidden="true"><img src="assets/rooms/library-wide.png" alt="" /><span class="study-entry-shade"></span><span class="study-entry-avatar"></span><span class="study-entry-bubble">Ready to focus?</span></div>
      <main class="study-entry-card">
        <div class="study-entry-brand"><span><i data-lucide="radio" aria-hidden="true"></i></span><b><strong>RadioTEDU</strong><small>STUDY WORLD</small></b></div>
        <div class="study-entry-stage" data-study-entry-stage></div>
      </main>
    </section>
  `
  const stage = document.querySelector<HTMLElement>('[data-study-entry-stage]')!
  const refreshIcons = () => createIcons({ icons: { BookOpen, LogIn, MessageCircle, Radio, ShieldCheck, Shirt, UserPlus } })
  const accountError = (error: unknown) => error instanceof Error ? error.message : 'The RadioTEDU account service is unavailable.'
  const setStatus = (message: string, state: 'idle' | 'error' | 'success' = 'idle') => {
    const target = stage.querySelector<HTMLElement>('[data-study-auth-status]')
    if (!target) return
    target.textContent = message
    target.dataset.state = state
  }

  const renderEntry = () => {
    stage.innerHTML = `
      <p class="study-entry-kicker">TEDU CAMPUS · LIVE STUDY ROOMS</p>
      <h1 id="study-entry-title">Study together.<br />Stay on campus.</h1>
      <p class="study-entry-copy">Enter the social campus to find a desk, join room chat, listen to RadioTEDU and build your verified study streak.</p>
      <div class="study-entry-features" aria-label="Study World features"><span><i data-lucide="book-open" aria-hidden="true"></i> Focus rooms</span><span><i data-lucide="message-circle" aria-hidden="true"></i> Room chat</span><span><i data-lucide="shirt" aria-hidden="true"></i> Your look</span></div>
      <nav class="study-entry-actions" aria-label="Account entry">
        <button class="study-entry-primary" type="button" data-study-auth-mode="login"><i data-lucide="log-in" aria-hidden="true"></i><span><strong>Log in</strong><small>Continue without leaving Study World</small></span></button>
        <button class="study-entry-secondary" type="button" data-study-auth-mode="register"><i data-lucide="user-plus" aria-hidden="true"></i><span><strong>Create account</strong><small>Join the RadioTEDU community</small></span></button>
      </nav>
      <p class="study-entry-security"><i data-lucide="shield-check" aria-hidden="true"></i><span><strong>Server-protected sign in</strong><small>Credentials go directly to the RadioTEDU account API over HTTPS and are never stored by the game.</small></span></p>
      <a class="study-entry-help" href="${entryConfig.helpUrl}" target="_blank" rel="noopener">Need help signing in?</a>
    `
    stage.querySelectorAll<HTMLButtonElement>('[data-study-auth-mode]').forEach((button) => {
      button.addEventListener('click', () => renderAuth(button.dataset.studyAuthMode === 'register' ? 'register' : 'login'))
    })
    refreshIcons()
  }

  const renderAuth = (mode: 'login' | 'register') => {
    const registering = mode === 'register'
    stage.innerHTML = `
      <button class="study-auth-back" type="button" data-study-auth-back>← Study World</button>
      <p class="study-entry-kicker">SECURE RADIOTEDU ACCOUNT</p>
      <h1 id="study-entry-title">${registering ? 'Create your account.' : 'Welcome back.'}</h1>
      <p class="study-entry-copy">${registering ? 'Create one shared account for Study, Focus, RTAI and Gold.' : 'Log in here and continue directly into Study World.'}</p>
      <div class="study-auth-tabs" role="tablist" aria-label="Account action">
        <button type="button" role="tab" aria-selected="${String(!registering)}" data-study-auth-switch="login">Log in</button>
        <button type="button" role="tab" aria-selected="${String(registering)}" data-study-auth-switch="register">Create account</button>
      </div>
      <form class="study-auth-form" data-study-auth-form="${mode}">
        ${registering ? '<label><span>Display name</span><input name="display_name" type="text" autocomplete="name" minlength="2" maxlength="100" required /></label>' : ''}
        <label><span>Email address</span><input name="email" type="email" autocomplete="email" inputmode="email" required data-study-auth-email /></label>
        ${registering ? '<label class="study-auth-age" data-study-auth-age hidden><span>Age</span><input name="age" type="number" inputmode="numeric" min="18" max="120" step="1" disabled /><small>Non-TEDU email addresses require age 18 or older.</small></label>' : ''}
        <label><span>Password</span><input name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" minlength="8" maxlength="200" required /></label>
        ${registering ? '<label class="study-auth-legal"><input name="legal" type="checkbox" required /><span>I accept the <a href="/kullanim-kosullari/" target="_blank" rel="noopener">Terms of Use</a> and acknowledge the <a href="/gizlilik-politikasi/" target="_blank" rel="noopener">Privacy Notice</a>.</span></label>' : '<p class="study-auth-legal-note">By continuing, you accept the <a href="/kullanim-kosullari/" target="_blank" rel="noopener">Terms of Use</a> and acknowledge the <a href="/gizlilik-politikasi/" target="_blank" rel="noopener">Privacy Notice</a>.</p>'}
        <p class="study-auth-status" role="status" aria-live="polite" data-study-auth-status></p>
        <button class="study-auth-submit" type="submit">${registering ? 'Create account' : 'Log in'} <span aria-hidden="true">→</span></button>
      </form>
      <div class="study-auth-divider"><span>TEDÜ ACCOUNT</span></div>
      <button class="study-auth-tedu" type="button" data-study-tedu-login><b aria-hidden="true">T</b><span><strong>TEDÜ ile Log in</strong><small>Use your verified TEDÜ identity</small></span></button>
      <p class="study-entry-security"><i data-lucide="shield-check" aria-hidden="true"></i><span><strong>Gold remains server-authoritative</strong><small>Signing in never changes Gold on the client. Balance and rewards are verified by RadioTEDU servers.</small></span></p>
    `
    stage.querySelector<HTMLButtonElement>('[data-study-auth-back]')?.addEventListener('click', renderEntry)
    stage.querySelectorAll<HTMLButtonElement>('[data-study-auth-switch]').forEach((button) => {
      button.addEventListener('click', () => renderAuth(button.dataset.studyAuthSwitch === 'register' ? 'register' : 'login'))
    })

    const form = stage.querySelector<HTMLFormElement>('[data-study-auth-form]')!
    const email = form.querySelector<HTMLInputElement>('[data-study-auth-email]')!
    const ageGroup = form.querySelector<HTMLElement>('[data-study-auth-age]')
    const age = ageGroup?.querySelector<HTMLInputElement>('input[name="age"]')
    const syncAge = () => {
      if (!ageGroup || !age) return
      const requiresAge = email.value.includes('@') && !isTeduEmailAddress(email.value)
      ageGroup.hidden = !requiresAge
      age.disabled = !requiresAge
      age.required = requiresAge
      if (!requiresAge) age.value = ''
    }
    email.addEventListener('input', syncAge)
    syncAge()

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
      const fields = new FormData(form)
      form.setAttribute('aria-busy', 'true')
      submit.disabled = true
      setStatus(registering ? 'Creating your account…' : 'Checking your account…')
      try {
        if (registering) {
          await registerStudyAccount({
            displayName: String(fields.get('display_name') || ''),
            email: String(fields.get('email') || ''),
            password: String(fields.get('password') || ''),
            age: fields.get('age') ? Number(fields.get('age')) : undefined,
            legalAccepted: fields.get('legal') === 'on',
          })
        } else {
          await loginStudyAccount(String(fields.get('email') || ''), String(fields.get('password') || ''))
        }
        const session = await verifyStudyAccountSession()
        if (!session.user?.id) throw new Error('The signed-in account could not be verified.')
        setStatus('Account verified. Entering Study World…', 'success')
        location.reload()
      } catch (error) {
        setStatus(accountError(error), 'error')
      } finally {
        form.removeAttribute('aria-busy')
        submit.disabled = false
      }
    })

    stage.querySelector<HTMLButtonElement>('[data-study-tedu-login]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget as HTMLButtonElement
      const popup = window.open('about:blank', 'radiotedu-study-tedu-login', 'popup=yes,width=520,height=720,menubar=no,toolbar=no,location=yes,resizable=yes,scrollbars=yes')
      if (!popup) {
        setStatus('Allow pop-ups for RadioTEDU to use TEDÜ Log in.', 'error')
        return
      }
      button.disabled = true
      setStatus('Preparing secure TEDÜ Log in…')
      try {
        const returnUri = new URL('/study/auth-callback.html', location.origin).href
        const result = await startStudyTeduLogin(returnUri)
        const authorizationUrl = result.authorization_url || result.authorize_url
        if (!authorizationUrl) throw new Error('The TEDÜ authorization address was not returned.')
        const target = new URL(authorizationUrl)
        if (target.protocol !== 'https:') throw new Error('The TEDÜ authorization address is not secure.')
        if ('BroadcastChannel' in window) popup.opener = null
        popup.location.replace(target.href)
        popup.focus()
        setStatus('TEDÜ Log in opened in a secure window.', 'success')
      } catch (error) {
        popup.close()
        setStatus(accountError(error), 'error')
      } finally {
        button.disabled = false
      }
    })
    refreshIcons()
  }

  let completingLogin = false
  const completeLogin = async (event: MessageEvent) => {
    if (event.source && event.origin !== location.origin) return
    if (!['radiotedu:erp-login-complete', 'radiotedu:account-login-complete'].includes(event.data?.type)) return
    if (completingLogin) return
    completingLogin = true
    try {
      const session = await verifyStudyAccountSession()
      if (!session.user?.id) throw new Error('The TEDÜ account could not be verified.')
      location.reload()
    } catch (error) {
      completingLogin = false
      setStatus(accountError(error), 'error')
    }
  }
  const accountChannel = 'BroadcastChannel' in window ? new BroadcastChannel('radiotedu-account-auth') : null
  accountChannel?.addEventListener('message', completeLogin)
  window.addEventListener('message', completeLogin)
  renderEntry()
  document.documentElement.dataset.studyReady = 'locked'
}

function renderUnavailableStudy() {
  ui!.innerHTML = `
    <section class="study-gate" role="alert">
      <strong>Study is unavailable</strong>
      <span>Your session could not be verified.</span>
    </section>
  `
  document.documentElement.dataset.studyReady = 'error'
}

function createLocalAdapter() {
  const embeddedAccount = window.RadioTEDUStudyAccount
  return new LocalStudyAdapter(embeddedAccount && typeof embeddedAccount.id === 'string' && typeof embeddedAccount.displayName === 'string'
    ? {
        account: {
          id: embeddedAccount.id,
          displayName: embeddedAccount.displayName.slice(0, 80),
          authenticated: embeddedAccount.authenticated === true,
        },
        globalPoints: Number.isFinite(embeddedAccount.globalPoints) ? embeddedAccount.globalPoints : 0,
      }
    : {})
}

function readSecureBridge() {
  const bridge = window.RadioTEDUStudyBridge
  if (!bridge || typeof bridge.apiBase !== 'string' || typeof bridge.request !== 'function') return null
  if (!bridge.account || typeof bridge.account.id !== 'string' || typeof bridge.account.displayName !== 'string' || bridge.account.authenticated !== true) return null
  const base = bridge.apiBase.replace(/\/+$/, '')
  return {
    apiBase: base.endsWith('/study') ? base : `${base}/study`,
    fetchImpl: bridge.request,
    account: {
      id: bridge.account.id,
      displayName: bridge.account.displayName.slice(0, 80),
      authenticated: true,
    } satisfies StudyAccount,
    globalPoints: bridge.globalPoints,
  }
}

function createSessionTracker(adapter: StudyAdapter) {
  if (!isSessionTransport(adapter)) return undefined
  return new StudySessionTracker(adapter)
}

function isSessionTransport(adapter: StudyAdapter): adapter is StudyAdapter & StudySessionTransport {
  return typeof adapter.startStudySession === 'function'
    && typeof adapter.heartbeatStudySession === 'function'
    && typeof adapter.finishStudySession === 'function'
}

type BoundHudPanels = Readonly<{
  open(panel: HudPanelName): void
  close(): void
}>

function bindPanels(): BoundHudPanels {
  const state = new HudPanelState()
  const render = () => {
    const current = state.snapshot().current
    document.documentElement.dataset.hudPanel = current
    document.querySelectorAll<HTMLElement>('[data-hud-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.hudPanel !== current
    })
    document.querySelectorAll<HTMLButtonElement>('[data-hud-toggle]').forEach((toggle) => {
      toggle.setAttribute('aria-expanded', state.expanded(toggle.dataset.hudToggle as HudPanelName))
    })
  }
  document.querySelectorAll<HTMLButtonElement>('[data-hud-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      state.toggle(toggle.dataset.hudToggle as HudPanelName)
      render()
      if (state.snapshot().current === 'closed') toggle.blur()
    })
  })
  document.querySelectorAll<HTMLButtonElement>('[data-hud-close]').forEach((close) => {
    close.addEventListener('click', () => {
      state.close()
      render()
      close.blur()
    })
  })
  render()
  return {
    open: (panel) => { state.open(panel); render() },
    close: () => { state.close(); render() },
  }
}

function bindGoldShop(
  adapter: StudyAdapter,
  session: StudySession,
  tracker: StudySessionTracker | undefined,
  panels: BoundHudPanels,
) {
  const grid = document.querySelector<HTMLElement>('#gear-grid')
  const message = document.querySelector<HTMLOutputElement>('#gear-message')
  if (!grid || !message) return
  studyGear.initialize(session.points.global, {
    authoritative: session.points.authoritative,
    ownedItemIds: session.ownedWearableIds,
    equippedItemIds: session.equippedWearableIds,
  })

  const render = (snapshot = studyGear.snapshot()) => {
    const currentSession = adapter.session()
    const goal = buildDailyFocusGoal({
      todaySeconds: tracker?.snapshot().summary.todaySeconds ?? currentSession.points.studyToday * 60,
      activeSeconds: tracker?.snapshot().activeSeconds ?? 0,
      running: tracker?.snapshot().running ?? false,
      counting: tracker ? tracker.snapshot().running && tracker.snapshot().focused && tracker.snapshot().foreground : false,
      targetMinutes: currentSession.points.dailyCap,
    })
    const balance = document.querySelector<HTMLElement>('#point-balance')
    if (balance) balance.textContent = String(snapshot.gold)
    const shopBalance = document.querySelector<HTMLElement>('#shop-gold-balance')
    const shopDaily = document.querySelector<HTMLElement>('#shop-gold-daily')
    const shopProgress = document.querySelector<HTMLElement>('#shop-gold-progress')
    const nextUnlock = document.querySelector<HTMLElement>('#shop-next-unlock')
    if (shopBalance) shopBalance.textContent = String(snapshot.gold)
    if (shopDaily) shopDaily.textContent = `${goal.verifiedMinutes}/${goal.targetMinutes} verified min`
    if (shopProgress) {
      shopProgress.setAttribute('aria-valuemax', String(goal.targetMinutes))
      shopProgress.setAttribute('aria-valuenow', String(goal.verifiedMinutes))
      const fill = shopProgress.querySelector<HTMLElement>('i')
      if (fill) fill.style.width = `${goal.progressPercent}%`
    }
    const ownedIds = new Set(currentSession.ownedWearableIds)
    const nextItem = GOLD_STORE_ITEMS.find((item) => !ownedIds.has(item.id) && item.price > snapshot.gold)
      ?? GOLD_STORE_ITEMS.find((item) => !ownedIds.has(item.id))
    if (nextUnlock) nextUnlock.textContent = nextItem
      ? snapshot.gold >= nextItem.price
        ? `${nextItem.name} is ready to unlock in Wardrobe.`
        : `${nextItem.price - snapshot.gold} more Gold to unlock ${nextItem.name}.`
      : 'All available Campus styles are unlocked.'
    grid.replaceChildren()
    for (const item of GOLD_STORE_ITEMS) {
      const owned = ownedIds.has(item.id)
      const equipped = currentSession.equippedWearableIds.includes(item.id)
      const card = document.createElement('article')
      card.className = 'gear-card'
      card.dataset.slot = item.slot
      card.dataset.storeItem = item.id
      const artwork = document.createElement('span')
      artwork.className = 'gear-artwork'
      artwork.setAttribute('aria-hidden', 'true')
      const swatch = document.createElement('i')
      swatch.className = `store-swatch swatch ${item.swatch}`
      artwork.append(swatch)
      const copy = document.createElement('span')
      const kind = document.createElement('small')
      kind.textContent = `${item.rarity} · ${item.slot.toUpperCase()}`
      const name = document.createElement('strong')
      name.textContent = item.name
      const description = document.createElement('b')
      description.textContent = item.description
      copy.append(kind, name, description)
      const action = document.createElement('button')
      action.type = 'button'
      action.dataset.storeItemId = item.id
      action.dataset.state = equipped ? 'equipped' : owned ? 'owned' : 'locked'
      action.textContent = equipped
        ? 'Equipped · open Wardrobe'
        : owned
          ? 'Owned · open Wardrobe'
          : snapshot.gold >= item.price
            ? `Unlock in Wardrobe · ${item.price} Gold`
            : `Need ${item.price - snapshot.gold} more Gold`
      action.setAttribute('aria-label', `${item.name}: ${action.textContent}`)
      card.append(artwork, copy, action)
      grid.append(card)
    }
  }

  grid.addEventListener('click', (event) => {
    const action = (event.target as Element).closest<HTMLButtonElement>('[data-store-item-id]')
    if (!action) return
    const id = action.dataset.storeItemId!
    const item = GOLD_STORE_ITEMS.find((candidate) => candidate.id === id)
    if (!item) return
    panels.open('wardrobe')
    const wardrobeItem = document.querySelector<HTMLButtonElement>(`[data-wearable-id="${id}"]`)
    wardrobeItem?.focus({ preventScroll: true })
    message.textContent = adapter.session().ownedWearableIds.includes(id)
      ? `${item.name} is owned. Choose it in Wardrobe to wear it.`
      : studyGear.snapshot().gold >= item.price
        ? `${item.name} is ready. Choose it in Wardrobe to confirm the ${item.price} Gold unlock.`
        : `Earn ${item.price - studyGear.snapshot().gold} more Gold to unlock ${item.name}.`
  })
  studyGear.subscribe(render)
  if (tracker) globalThis.setInterval(() => render(), 1_000)
}

type StudyComputerItem = Readonly<{
  item_id: string
  title: string
  description: string
  kind: string
  cost_points: number
  rarity: string
  asset_key: string
  owned: boolean
  equipped: boolean
}>

function bindComputerShop(
  adapter: StudyAdapter,
  bridge: ActiveStudyBridge | null,
) {
  const grid = document.querySelector<HTMLElement>('#computer-grid')
  const message = document.querySelector<HTMLOutputElement>('#gear-message')
  if (!grid || !message) return
  if (!bridge) {
    grid.textContent = 'Sign in to use the shared computer store.'
    return
  }

  const economyBase = `${bridge.apiBase.replace(/\/study$/, '')}/economy`
  const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers || {})
    headers.set('Accept', 'application/json')
    if (options.body) headers.set('Content-Type', 'application/json')
    const response = await bridge.fetchImpl(`${economyBase}${path}`, { ...options, headers })
    const body = await response.json().catch(() => null) as { success?: boolean, data?: T, error?: string, message?: string } | null
    if (!response.ok || body?.success === false) throw new Error(body?.error || body?.message || `HTTP ${response.status}`)
    return (body && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body) as T
  }

  const synchronizeBalance = (points: unknown) => {
    const balance = Math.max(0, Math.floor(Number(points) || 0))
    adapter.syncGoldBalance?.(balance)
    studyGear.synchronizeGold(balance)
    document.querySelectorAll<HTMLElement>('#point-balance, #shop-gold-balance').forEach((node) => { node.textContent = String(balance) })
  }

  const render = (items: readonly StudyComputerItem[]) => {
    grid.replaceChildren()
    for (const item of items) {
      const card = document.createElement('article')
      card.className = 'computer-card'
      card.dataset.rarity = item.rarity
      const artwork = document.createElement('span')
      artwork.className = `computer-artwork computer-artwork--${item.asset_key}`
      artwork.setAttribute('aria-hidden', 'true')
      artwork.innerHTML = '<i data-lucide="monitor"></i>'
      const copy = document.createElement('span')
      const kind = document.createElement('small')
      kind.textContent = `${item.rarity} · ${item.cost_points} Gold`
      const title = document.createElement('strong')
      title.textContent = item.title
      const description = document.createElement('b')
      description.textContent = item.description
      copy.append(kind, title, description)
      const action = document.createElement('button')
      action.type = 'button'
      action.dataset.computerItem = item.item_id
      action.dataset.action = item.owned ? 'equip' : 'purchase'
      action.disabled = item.equipped
      action.textContent = item.equipped ? 'Equipped' : item.owned ? 'Equip' : `Buy · ${item.cost_points} Gold`
      card.append(artwork, copy, action)
      grid.append(card)
    }
    createIcons({ icons: { Monitor } })
  }

  const refresh = async () => {
    const data = await request<{ items: StudyComputerItem[], gold_balance: number }>('/study/shop')
    synchronizeBalance(data.gold_balance)
    render(data.items)
  }

  grid.addEventListener('click', async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-computer-item]')
    if (!button || button.disabled) return
    button.disabled = true
    message.textContent = button.dataset.action === 'purchase' ? 'Verifying purchase…' : 'Equipping computer…'
    try {
      const itemId = encodeURIComponent(button.dataset.computerItem || '')
      if (button.dataset.action === 'purchase') {
        const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `study-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const data = await request<{ gold_balance: number }>(`/study/shop/${itemId}/purchase`, {
          method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: '{}',
        })
        synchronizeBalance(data.gold_balance)
        message.textContent = 'Computer purchased securely. It is now yours.'
      } else {
        await request(`/study/shop/${itemId}/equip`, { method: 'POST', body: '{}' })
        message.textContent = 'Computer equipped.'
      }
      await refresh()
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Computer action failed.'
      button.disabled = false
    }
  })

  grid.textContent = 'Loading shared computer store…'
  refresh().catch((error) => { grid.textContent = error instanceof Error ? error.message : 'Computer store unavailable.' })
}

function bindRoomInstance(adapter: StudyAdapter, initialRoomId: StudyRoomId) {
  let roomId = initialRoomId
  const render = () => {
    const instance = adapter.roomInstance?.(roomId) ?? null
    const output = document.querySelector<HTMLOutputElement>('#room-instance')
    if (output) {
      output.value = formatRoomInstanceLabel(instance)
      output.textContent = output.value
    }
    document.documentElement.dataset.roomInstanceId = instance?.id ?? 'assigning'
  }

  window.addEventListener('radiotedu:study-room-changed', (event) => {
    const detail = (event as CustomEvent<{ roomId: StudyRoomId }>).detail
    if (detail?.roomId) roomId = detail.roomId
    render()
  })
  window.addEventListener('radiotedu:study-instance-changed', (event) => {
    const detail = (event as CustomEvent<{ instance: StudyRoomInstance }>).detail
    if (detail?.instance.roomId === roomId) render()
  })
  render()
}

function bindRoomArrival(initialRoomId: StudyRoomId) {
  let hideTimer = 0
  const arrival = document.querySelector<HTMLElement>('#room-arrival')
  const title = document.querySelector<HTMLElement>('#room-arrival-title')
  const copy = document.querySelector<HTMLElement>('#room-arrival-copy')
  if (!arrival || !title || !copy) return

  const show = (roomId: StudyRoomId) => {
    title.textContent = IMAGE_ROOMS[roomId].title
    copy.textContent = ROOM_SUMMARIES[roomId]
    arrival.hidden = false
    arrival.classList.remove('is-showing')
    void arrival.offsetWidth
    arrival.classList.add('is-showing')
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => {
      arrival.classList.remove('is-showing')
      arrival.hidden = true
    }, 2_200)
  }

  window.addEventListener('radiotedu:study-room-changed', (event) => {
    const roomId = (event as CustomEvent<{ roomId: StudyRoomId }>).detail?.roomId
    if (roomId) show(roomId)
  })
  window.setTimeout(() => show(initialRoomId), 350)
}

function bindCampusNavigator(adapter: StudyAdapter, panels: BoundHudPanels) {
  const list = document.querySelector<HTMLElement>('#navigator-room-list')
  const search = document.querySelector<HTMLInputElement>('#navigator-search')
  const filters = [...document.querySelectorAll<HTMLButtonElement>('[data-room-category]')]
  if (!list || !search) return
  let category: CampusRoomCategory | 'all' = 'all'

  const render = () => {
    list.replaceChildren()
    const rooms = filterCampusRooms(search.value, category)
    for (const room of rooms) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'navigator-room-card'
      card.dataset.roomId = room.id
      card.dataset.current = String(currentRoomId() === room.id)
      card.style.setProperty('--room-accent', room.accent)

      const image = document.createElement('img')
      image.src = `${import.meta.env.BASE_URL}${room.imageUrl}`
      image.alt = ''
      image.loading = 'lazy'
      const shade = document.createElement('span')
      shade.className = 'navigator-room-shade'
      const copy = document.createElement('span')
      copy.className = 'navigator-room-copy'
      const eyebrow = document.createElement('small')
      eyebrow.textContent = room.category.toUpperCase()
      const title = document.createElement('strong')
      title.textContent = room.title
      const description = document.createElement('b')
      description.textContent = room.description
      const instance = adapter.roomInstance?.(room.id)
      const status = document.createElement('em')
      status.textContent = currentRoomId() === room.id
        ? `YOU ARE HERE · ${instance ? `${instance.occupancy}/${instance.capacity}` : 'LIVE'}`
        : instance
          ? `ROOM ${instance.number} · ${instance.occupancy}/${instance.capacity}`
          : 'OPEN'
      copy.append(eyebrow, title, description, status)
      card.append(image, shade, copy)
      card.addEventListener('click', () => {
        document.querySelector<HTMLButtonElement>(`[role="tab"][data-room-id="${room.id}"]`)?.click()
        panels.close()
      })
      list.append(card)
    }
    list.dataset.empty = String(rooms.length === 0)
    if (rooms.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'navigator-empty'
      empty.textContent = 'No campus place matches that search.'
      list.append(empty)
    }
  }

  search.addEventListener('input', render)
  for (const filter of filters) {
    filter.addEventListener('click', () => {
      category = filter.dataset.roomCategory as CampusRoomCategory | 'all'
      for (const candidate of filters) candidate.ariaPressed = String(candidate === filter)
      render()
    })
  }
  window.addEventListener('radiotedu:study-room-changed', render)
  window.addEventListener('radiotedu:study-instance-changed', render)
  render()
}

function bindEvents(adapter: StudyAdapter, panels: BoundHudPanels) {
  let events: StudyWorldEvent[] = []
  const list = document.querySelector<HTMLElement>('#event-list')!

  const render = () => {
    list.replaceChildren()
    const visibleEvents = events.filter((event) => event.status !== 'completed')
    document.querySelector('#event-count')!.textContent = String(visibleEvents.length)
    const featured = visibleEvents.find((event) => event.status === 'active') ?? visibleEvents[0]
    document.querySelector('#next-event-title')!.textContent = featured?.title ?? 'No scheduled action'
    document.querySelector('#next-event-location')!.textContent = featured?.location ?? 'Check back soon'
    document.querySelector('#next-event-reward')!.textContent = featured ? `+${featured.rewardGold} Gold` : 'Gold reward'

    if (events.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'event-empty'
      empty.textContent = 'No campus events are available right now.'
      list.append(empty)
      return
    }

    for (const worldEvent of events) {
      const card = document.createElement('article')
      card.className = 'event-card'
      card.dataset.status = worldEvent.status
      card.dataset.testid = `event-${worldEvent.id}`

      const meta = document.createElement('div')
      meta.className = 'event-meta'
      const state = document.createElement('small')
      state.textContent = worldEvent.status === 'active' ? 'HAPPENING NOW' : worldEvent.status.toUpperCase()
      const reward = document.createElement('b')
      reward.textContent = `+${worldEvent.rewardGold} Gold`
      meta.append(state, reward)

      const title = document.createElement('strong')
      title.textContent = worldEvent.title
      const description = document.createElement('p')
      description.textContent = worldEvent.description
      const details = document.createElement('span')
      details.textContent = `${worldEvent.location} · ${formatEventWhen(worldEvent)}`
      const action = document.createElement('button')
      action.type = 'button'
      action.className = 'event-register'
      action.dataset.eventId = worldEvent.id
      action.disabled = worldEvent.registered || worldEvent.status === 'completed' || !adapter.registerEvent
      action.textContent = worldEvent.registered ? 'Registered' : worldEvent.status === 'completed' ? 'Finished' : 'Join event'
      action.addEventListener('click', () => {
        if (!adapter.registerEvent) return
        action.disabled = true
        action.textContent = 'Joining…'
        void adapter.registerEvent(worldEvent.id).then((registered) => {
          events = events.map((candidate) => candidate.id === registered.id ? registered : candidate)
          render()
          setHudMessage('EVENT JOINED')
        }).catch(() => {
          action.disabled = false
          action.textContent = 'Try again'
          setHudMessage('EVENT UNAVAILABLE')
        })
      })

      card.append(meta, title, description, details, action)
      list.append(card)
    }
  }

  document.querySelector('.rail-briefing')?.addEventListener('click', () => panels.open('events'))
  if (!adapter.listEvents) {
    render()
    return
  }
  void adapter.listEvents().then((loaded) => {
    events = [...loaded]
    render()
  }).catch(() => {
    render()
    setHudMessage('EVENTS OFFLINE')
  })
}

function bindStudyPath(tracker: StudySessionTracker | undefined, initialRoomId: StudyRoomId) {
  const list = document.querySelector<HTMLElement>('#study-path-list')
  const eventList = document.querySelector<HTMLElement>('#event-list')
  const intro = document.querySelector<HTMLElement>('#events-panel-intro')
  const title = document.querySelector<HTMLElement>('#events-panel-title')
  const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-events-view]')]
  if (!list || !eventList || !intro || !title) return
  const visitedRooms = new Set<StudyRoomId>([initialRoomId])
  let socialActions = 0

  const render = () => {
    const snapshot = tracker?.snapshot()
    const goals = buildStudyPath({
      todaySeconds: snapshot?.summary.todaySeconds ?? 0,
      totalSeconds: snapshot?.summary.totalSeconds ?? 0,
      visitedRooms,
      socialActions,
      seatedNow: snapshot?.running ?? false,
    })
    list.replaceChildren()
    for (const goal of goals) {
      const card = document.createElement('article')
      card.className = 'study-path-card'
      card.dataset.goalId = goal.id
      card.dataset.complete = String(goal.complete)
      const heading = document.createElement('span')
      const state = document.createElement('i')
      state.textContent = goal.complete ? '✓' : String(goals.indexOf(goal) + 1)
      const copy = document.createElement('span')
      const goalTitle = document.createElement('strong')
      goalTitle.textContent = goal.title
      const description = document.createElement('small')
      description.textContent = goal.description
      copy.append(goalTitle, description)
      const progress = document.createElement('b')
      const unit = goal.unit === 'minutes' ? 'min' : goal.unit === 'rooms' ? 'rooms' : goal.unit === 'actions' ? 'action' : 'step'
      progress.textContent = `${goal.progress}/${goal.target} ${unit}`
      heading.append(state, copy, progress)
      const track = document.createElement('span')
      track.className = 'study-path-progress'
      const fill = document.createElement('i')
      fill.style.width = `${(goal.progress / goal.target) * 100}%`
      track.append(fill)
      card.append(heading, track)
      list.append(card)
    }
    document.documentElement.dataset.studyGoalsComplete = String(goals.filter((goal) => goal.complete).length)
  }

  const setView = (view: 'events' | 'path') => {
    eventList.hidden = view !== 'events'
    list.hidden = view !== 'path'
    title.textContent = view === 'events' ? 'Events' : 'Study Path'
    intro.textContent = view === 'events'
      ? 'Join campus actions with your RadioTEDU account. Gold is awarded only after server verification.'
      : 'Session milestones guide your study. They never create Gold on this device.'
    for (const button of viewButtons) button.ariaSelected = String(button.dataset.eventsView === view)
    if (view === 'path') render()
  }
  for (const button of viewButtons) button.addEventListener('click', () => setView(button.dataset.eventsView === 'path' ? 'path' : 'events'))
  window.addEventListener('radiotedu:study-room-changed', (event) => {
    const roomId = (event as CustomEvent<{ roomId: StudyRoomId }>).detail?.roomId
    if (roomId) visitedRooms.add(roomId)
    render()
  })
  window.addEventListener('radiotedu:study-social-action', () => {
    socialActions += 1
    render()
  })
  globalThis.setInterval(render, 1_000)
  setView('events')
  render()
}

function formatEventWhen(worldEvent: StudyWorldEvent): string {
  if (!worldEvent.startsAt) return worldEvent.status === 'active' ? 'Open now' : 'Schedule in app'
  const date = new Date(worldEvent.startsAt)
  if (Number.isNaN(date.getTime())) return 'Schedule in app'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function bindGlobalShortcuts(panels: BoundHudPanels) {
  window.addEventListener('keydown', (event) => {
    const target = event.target
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)
    if (event.key === 'Escape') {
      panels.close()
      if (typing) (target as HTMLElement).blur()
      return
    }
    if (event.key === 'Enter' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      panels.open('chat')
      document.querySelector<HTMLInputElement>('#chat-input')?.focus()
    }
  })
}

const CHAT_MAX_LENGTH = 180
const CHAT_REFRESH_INTERVAL_MS = 3_000
const CHAT_UNSAFE_CONTROLS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g

function normalizeChatInput(value: string): string {
  return value.replace(CHAT_UNSAFE_CONTROLS, ' ').replace(/\s+/g, ' ').trim()
}

function showChatInWorld(message: StudyChatMessage, roomId: StudyRoomId): void {
  window.dispatchEvent(new CustomEvent('radiotedu:study-chat-message', {
    detail: { message, roomId },
  }))
}

function bindChat(adapter: StudyAdapter, safety: IgnoredPlayerStore) {
  const accountId = adapter.session().account.id
  const seenMessageIds = new Set<string>()
  let hydratedRoom: StudyRoomId | null = null
  let pending = false
  let unread = 0

  const feedback = (message: string, state: 'idle' | 'sending' | 'error' = 'idle') => {
    const output = document.querySelector<HTMLElement>('#chat-feedback')
    if (!output) return
    output.textContent = message
    output.dataset.state = state
  }
  const syncUnread = () => {
    const badge = document.querySelector<HTMLElement>('#chat-unread')
    if (!badge) return
    badge.textContent = String(Math.min(unread, 99))
    badge.hidden = unread === 0
  }
  const syncRoomLabel = () => {
    const label = document.querySelector<HTMLElement>('#chat-room-label')
    if (!label) return
    const room = document.querySelector<HTMLElement>('#room-title')?.textContent?.trim() || currentRoomId()
    const instance = document.querySelector<HTMLElement>('#room-instance')?.textContent?.trim() || 'Room'
    label.textContent = `${room} · ${instance}`.toUpperCase()
  }
  const markRead = () => {
    unread = 0
    syncUnread()
  }
  document.querySelector('#chat-toggle')?.addEventListener('click', () => {
    globalThis.setTimeout(() => {
      if (document.documentElement.dataset.hudPanel === 'chat') markRead()
    })
  })

  const input = document.querySelector<HTMLInputElement>('#chat-input')!
  const form = document.querySelector<HTMLFormElement>('#chat-form')!
  const sendButton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
  const counter = document.querySelector<HTMLElement>('#chat-counter')!
  input.addEventListener('input', () => {
    counter.textContent = `${input.value.length}/${CHAT_MAX_LENGTH}`
    counter.dataset.nearLimit = String(input.value.length >= 150)
    if (document.documentElement.dataset.hudPanel === 'chat') markRead()
  })

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (pending) return
    const roomId = currentRoomId()
    const messageText = normalizeChatInput(input.value)
    if (!messageText) {
      feedback('Write a message first.', 'error')
      input.focus()
      return
    }
    if (messageText.length > CHAT_MAX_LENGTH) {
      feedback(`Messages can be up to ${CHAT_MAX_LENGTH} characters.`, 'error')
      return
    }
    pending = true
    input.disabled = true
    sendButton.disabled = true
    form.setAttribute('aria-busy', 'true')
    feedback('Sending securely…', 'sending')
    void Promise.resolve(adapter.sendChat(messageText, roomId)).then((message) => {
      applyStudyRoomResponse(roomId, currentRoomId, message, (accepted) => {
        seenMessageIds.add(accepted.id)
        appendChatMessage(accepted, accountId)
        showChatInWorld(accepted, roomId)
        window.dispatchEvent(new CustomEvent('radiotedu:study-social-action', { detail: { kind: 'chat' } }))
        feedback('Delivered to this room.')
      })
      input.value = ''
      counter.textContent = `0/${CHAT_MAX_LENGTH}`
    }).catch((error: unknown) => {
      if (roomId !== currentRoomId()) return
      const code = error instanceof StudyAdapterError ? error.code : 'CHAT_UNAVAILABLE'
      feedback(code === 'CHAT_RATE_LIMITED' ? 'Slow down—you can send again in a moment.' : 'Message could not be sent. Please try again.', 'error')
      setHudMessage(code === 'CHAT_RATE_LIMITED' ? 'CHAT COOLDOWN' : 'MESSAGE NOT SENT')
    }).finally(() => {
      pending = false
      input.disabled = false
      sendButton.disabled = false
      form.removeAttribute('aria-busy')
      if (document.documentElement.dataset.hudPanel === 'chat') input.focus()
    })
  })

  for (const reaction of document.querySelectorAll<HTMLButtonElement>('[data-chat-reaction]')) {
    reaction.addEventListener('click', () => {
      if (pending) return
      input.value = reaction.dataset.chatReaction ?? ''
      input.dispatchEvent(new Event('input', { bubbles: true }))
      form.requestSubmit()
    })
  }

  if (adapter.refreshChat) {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      const roomId = currentRoomId()
      void adapter.refreshChat!(roomId).then((messages) => {
        applyStudyRoomResponse(roomId, currentRoomId, messages, (accepted) => {
          const visibleMessages = safety.filter(accepted)
          const newMessages = hydratedRoom === roomId
            ? visibleMessages.filter((message) => !seenMessageIds.has(message.id))
            : []
          const newRemote = newMessages.filter((message) => message.userId !== accountId).length
          seenMessageIds.clear()
          for (const message of visibleMessages) seenMessageIds.add(message.id)
          hydratedRoom = roomId
          renderChatMessages(visibleMessages, accountId)
          for (const message of newMessages.slice(-3)) showChatInWorld(message, roomId)
          if (newRemote && document.documentElement.dataset.hudPanel !== 'chat') {
            unread += newRemote
            syncUnread()
          }
          document.querySelector('#chat-connection')?.classList.remove('is-offline')
          feedback('Be kind · No spam · Room chat')
        })
      }).catch(() => {
        document.querySelector('#chat-connection')?.classList.add('is-offline')
        feedback('Reconnecting to room chat…', 'error')
      })
    }
    window.addEventListener('radiotedu:study-room-changed', () => {
      hydratedRoom = null
      seenMessageIds.clear()
      unread = 0
      syncUnread()
      syncRoomLabel()
      refresh()
    })
    globalThis.setInterval(refresh, CHAT_REFRESH_INTERVAL_MS)
    syncRoomLabel()
    refresh()
  }

  window.addEventListener('radiotedu:study-ignore-changed', (event) => {
    const userId = (event as CustomEvent<{ userId: string }>).detail?.userId
    if (!userId) return
    for (const message of document.querySelectorAll<HTMLElement>('.chat-message')) {
      if (message.dataset.userId === userId && safety.has(userId)) message.remove()
    }
  })
}

function renderChatMessages(messages: readonly StudyChatMessage[], accountId: string) {
  const log = document.querySelector<HTMLElement>('#chat-log')
  if (!log) return
  log.replaceChildren()
  for (const message of messages.slice(-30)) appendChatMessage(message, accountId)
  if (!messages.length) {
    const empty = document.createElement('div')
    empty.className = 'chat-empty'
    const icon = document.createElement('i')
    const title = document.createElement('strong')
    const copy = document.createElement('span')
    title.textContent = 'Room chat is open'
    copy.textContent = 'Say hello to people studying here.'
    empty.append(icon, title, copy)
    log.append(empty)
  }
  log.scrollTop = log.scrollHeight
}

function appendChatMessage(message: StudyChatMessage, accountId?: string) {
  const line = document.createElement('article')
  line.className = 'chat-message'
  line.dataset.own = String(message.userId === accountId)
  line.dataset.messageId = message.id
  line.dataset.userId = message.userId
  const avatar = document.createElement('span')
  avatar.className = 'chat-avatar'
  avatar.textContent = message.displayName.trim().slice(0, 1).toUpperCase() || '?'
  const content = document.createElement('span')
  content.className = 'chat-message-content'
  const meta = document.createElement('span')
  meta.className = 'chat-message-meta'
  const name = document.createElement('strong')
  const time = document.createElement('time')
  const copy = document.createElement('span')
  name.textContent = message.displayName
  time.dateTime = new Date(message.createdAt).toISOString()
  time.textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(message.createdAt)
  copy.textContent = message.text
  meta.append(name, time)
  content.append(meta, copy)
  line.append(avatar, content)
  const log = document.querySelector<HTMLElement>('#chat-log')
  log?.querySelector('.chat-empty')?.remove()
  log?.append(line)
  while (log && log.childElementCount > 30) log.firstElementChild?.remove()
  if (log) log.scrollTop = log.scrollHeight
}

function bindPresence(adapter: StudyAdapter, panels: BoundHudPanels, safety: IgnoredPlayerStore) {
  let selected: StudyPresence | null = null
  const select = (presence: StudyPresence) => {
    selected = presence
    document.querySelector('#player-card-name')!.textContent = presence.displayName
    document.querySelector('#player-card-status')!.textContent = safety.has(presence.userId) ? 'Ignored in chat' : presence.seatId ? 'Studying at a seat' : 'In this room'
    const ignore = document.querySelector<HTMLButtonElement>('#player-ignore')
    if (ignore) {
      ignore.textContent = safety.has(presence.userId) ? 'Unignore' : 'Ignore'
      ignore.ariaPressed = String(safety.has(presence.userId))
    }
    const reportControls = document.querySelector<HTMLElement>('#player-report-controls')
    if (reportControls) reportControls.hidden = true
    panels.open('profile')
  }
  const render = (presence: readonly StudyPresence[]) => {
    const list = document.querySelector<HTMLElement>('#player-list')!
    list.replaceChildren()
    for (const player of presence) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.testid = `presence-${player.userId}`
      button.dataset.userId = player.userId
      const dot = document.createElement('i')
      dot.style.backgroundColor = `#${player.color.toString(16).padStart(6, '0')}`
      const copy = document.createElement('span')
      const name = document.createElement('strong')
      const state = document.createElement('small')
      name.textContent = player.displayName
      state.textContent = safety.has(player.userId) ? 'Ignored' : player.seatId ? 'Studying' : 'Online'
      copy.append(name, state)
      button.append(dot, copy)
      button.addEventListener('click', () => select(player))
      list.append(button)
    }
    document.querySelector('#people-count')!.textContent = String(presence.length)
  }

  render(adapter.presence(initialRoom))
  window.addEventListener('radiotedu:study-presence-updated', (event) => {
    const detail = (event as CustomEvent<{ roomId: StudyRoomId; presence: readonly StudyPresence[] }>).detail
    if (detail?.roomId === currentRoomId()) render(detail.presence)
  })
  window.addEventListener('radiotedu:study-room-changed', () => {
    selected = null
    panels.close()
    render(adapter.presence(currentRoomId()))
  })
  window.addEventListener('radiotedu:study-player-selected', (event) => {
    const detail = (event as CustomEvent<{ presence: StudyPresence }>).detail
    if (detail?.presence) select(detail.presence)
  })
  document.querySelector('#player-wave')?.addEventListener('click', () => {
    if (!selected) return
    void Promise.resolve(adapter.sendChat(`* waves to ${selected.displayName} *`, currentRoomId()))
      .then((message) => {
        appendChatMessage(message, adapter.session().account.id)
        showChatInWorld(message, currentRoomId())
        window.dispatchEvent(new CustomEvent('radiotedu:study-social-action', { detail: { kind: 'wave' } }))
      })
      .catch(() => setHudMessage('WAVE NOT SENT'))
  })

  document.querySelector('#player-ignore')?.addEventListener('click', () => {
    if (!selected) return
    const ignored = safety.toggle(selected.userId)
    const button = document.querySelector<HTMLButtonElement>('#player-ignore')
    if (button) {
      button.textContent = ignored ? 'Unignore' : 'Ignore'
      button.ariaPressed = String(ignored)
    }
    document.querySelector('#player-card-status')!.textContent = ignored ? 'Ignored in chat' : selected.seatId ? 'Studying at a seat' : 'In this room'
    window.dispatchEvent(new CustomEvent('radiotedu:study-ignore-changed', { detail: { userId: selected.userId, ignored } }))
    render(adapter.presence(currentRoomId()))
    setHudMessage(ignored ? 'PLAYER IGNORED' : 'PLAYER UNIGNORED')
  })

  const reportControls = document.querySelector<HTMLFormElement>('#player-report-controls')
  document.querySelector('#player-report')?.addEventListener('click', () => {
    if (reportControls) reportControls.hidden = false
  })
  document.querySelector('#player-report-cancel')?.addEventListener('click', () => {
    if (reportControls) reportControls.hidden = true
  })
  reportControls?.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!selected || !adapter.reportPlayer) return
    const reason = document.querySelector<HTMLSelectElement>('#player-report-reason')?.value as StudyPlayerReportReason
    const submit = reportControls.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (submit) submit.disabled = true
    void adapter.reportPlayer(selected.userId, currentRoomId(), reason).then(() => {
      reportControls.hidden = true
      setHudMessage('REPORT SENT')
    }).catch(() => setHudMessage('REPORT NOT SENT')).finally(() => {
      if (submit) submit.disabled = false
    })
  })
}

function bindAttention(tracker?: StudySessionTracker) {
  if (!tracker) return
  const sync = () => tracker.setAttention(document.hasFocus(), document.visibilityState === 'visible')
  document.addEventListener('visibilitychange', sync)
  window.addEventListener('focus', sync)
  window.addEventListener('blur', sync)
  window.addEventListener('pagehide', () => { void tracker.dispose().catch(() => undefined) })
  sync()
}

function bindStudyClock(tracker: StudySessionTracker | undefined, adapter: StudyAdapter) {
  const render = (snapshot: StudySessionSnapshot) => {
    const timer = document.querySelector<HTMLElement>('#study-timer')
    if (!timer) return
    const activelyCounting = snapshot.running && snapshot.focused && snapshot.foreground
    const authoritativeGold = adapter.session().points.global
    const displayedGold = studyGear.snapshot().gold
    if (authoritativeGold !== displayedGold) {
      studyGear.synchronizeGold(authoritativeGold)
      if (authoritativeGold > displayedGold) announceGoldBanked(authoritativeGold - displayedGold)
    }
    timer.textContent = formatDuration(snapshot.activeSeconds)
    timer.dataset.running = String(snapshot.running)
    document.documentElement.dataset.studyActive = String(snapshot.running)
    document.documentElement.dataset.studyCounting = String(activelyCounting)
    document.querySelector('#study-today')!.textContent = formatCompactDuration(snapshot.summary.todaySeconds)
    document.querySelector('#study-month')!.textContent = formatCompactDuration(snapshot.summary.monthSeconds)
    const phase = document.querySelector<HTMLElement>('#study-phase')
    if (phase) phase.textContent = activelyCounting ? 'FOCUSING NOW' : snapshot.running ? 'FOCUS PAUSED' : 'FOCUS READY'
    const missionKicker = document.querySelector<HTMLElement>('#study-mission-kicker')
    const missionTitle = document.querySelector<HTMLElement>('#study-mission-title')
    const missionCopy = document.querySelector<HTMLElement>('#study-mission-copy')
    const missionMeter = document.querySelector<HTMLElement>('#study-mission-meter')
    const missionReward = document.querySelector<HTMLElement>('#study-mission-reward')
    const missionProgress = document.querySelector<HTMLElement>('#study-mission-progress')
    if (missionKicker && missionTitle && missionCopy && missionMeter && missionReward && missionProgress) {
      const goal = buildDailyFocusGoal({
        todaySeconds: snapshot.summary.todaySeconds,
        activeSeconds: snapshot.activeSeconds,
        running: snapshot.running,
        counting: activelyCounting,
        targetMinutes: adapter.session().points.dailyCap,
      })
      missionKicker.textContent = goal.kicker
      missionTitle.textContent = goal.title
      missionCopy.textContent = goal.copy
      missionMeter.textContent = goal.meterLabel
      missionReward.textContent = goal.rewardLabel
      missionProgress.setAttribute('aria-valuemax', String(goal.targetMinutes))
      missionProgress.setAttribute('aria-valuenow', String(goal.verifiedMinutes))
      missionProgress.querySelector<HTMLElement>('i')!.style.width = `${goal.progressPercent}%`
      document.documentElement.dataset.dailyFocusComplete = String(goal.complete)
    }
  }
  const empty: StudySessionSnapshot = {
    running: false,
    activeSeconds: 0,
    roomId: null,
    seatId: null,
    focused: true,
    foreground: true,
    summary: { todaySeconds: 0, monthSeconds: 0, totalSeconds: 0 },
  }
  render(tracker?.snapshot() ?? empty)
  if (tracker) globalThis.setInterval(() => render(tracker.snapshot()), 250)
  if (tracker && adapter.fetchSummary) {
    void adapter.fetchSummary().then((summary: StudyTimeSummary) => tracker.setSummary(summary)).catch(() => undefined)
  }
}

let goldToastTimer: ReturnType<typeof globalThis.setTimeout> | undefined

function announceGoldBanked(amount: number) {
  const toast = document.querySelector<HTMLOutputElement>('#gold-toast')
  if (!toast || amount <= 0) return
  if (goldToastTimer !== undefined) globalThis.clearTimeout(goldToastTimer)
  toast.value = `+${amount} GOLD BANKED`
  toast.textContent = `+${amount} GOLD BANKED`
  toast.hidden = false
  toast.dataset.visible = 'true'
  goldToastTimer = globalThis.setTimeout(() => {
    toast.dataset.visible = 'false'
    toast.hidden = true
  }, 3_200)
}

function bindRadioPlayer() {
  const player = document.querySelector<HTMLElement>('.radio-mini')
  const toggle = document.querySelector<HTMLButtonElement>('#radio-toggle')
  const status = document.querySelector<HTMLElement>('#radio-status')
  if (!player || !toggle || !status) return

  const audio = new Audio(STUDY_RADIO_STREAM_URL)
  audio.preload = 'none'
  audio.volume = 0.72
  let starting = false

  const setState = (state: 'ready' | 'loading' | 'playing' | 'error') => {
    const playing = state === 'playing'
    player.dataset.state = state
    player.dataset.playing = String(playing)
    document.documentElement.dataset.radioPlaying = String(playing)
    toggle.disabled = state === 'loading'
    toggle.ariaPressed = String(playing)
    toggle.ariaLabel = playing ? 'Pause RadioTEDU' : 'Play RadioTEDU'
    status.textContent = state === 'loading'
      ? 'Main Channel · Connecting…'
      : state === 'playing'
        ? 'Main Channel · On air'
        : state === 'error'
          ? 'Main Channel · Try again'
          : 'Main Channel · Ready'
  }

  const play = async () => {
    if (starting) return
    starting = true
    setState('loading')
    try {
      if (!audio.src) audio.src = STUDY_RADIO_STREAM_URL
      await audio.play()
      setState('playing')
    } catch {
      setState('error')
      setHudMessage('RADIO UNAVAILABLE')
    } finally {
      starting = false
    }
  }

  const pause = () => {
    audio.pause()
    setState('ready')
  }

  toggle.addEventListener('click', () => {
    if (player.dataset.playing === 'true') pause()
    else void play()
  })
  audio.addEventListener('playing', () => setState('playing'))
  audio.addEventListener('waiting', () => setState('loading'))
  audio.addEventListener('stalled', () => setState('error'))
  audio.addEventListener('error', () => {
    if (starting || player.dataset.playing === 'true') setState('error')
  })
  window.addEventListener('pagehide', () => audio.pause())

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'RadioTEDU',
      artist: 'Main Channel',
      album: 'TEDU Study Campus',
    })
    navigator.mediaSession.setActionHandler('play', () => { void play() })
    navigator.mediaSession.setActionHandler('pause', pause)
  }
  setState('ready')
}

function currentRoomId(): StudyRoomId {
  const roomId = document.documentElement.dataset.roomId
  return roomId && roomId in IMAGE_ROOMS ? roomId as StudyRoomId : 'library'
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3_600)
  const minutes = Math.floor((safe % 3_600) / 60)
  const remainingSeconds = safe % 60
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':')
}

function formatCompactDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  if (safe < 60) return `${safe}s`
  const minutes = Math.floor(safe / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

function setHudMessage(message: string) {
  const status = document.querySelector<HTMLOutputElement>('#game-status')
  if (!status) return
  status.value = message
  status.textContent = message
}

declare global {
  interface Window {
    RadioTEDUStudyAccount?: {
      id: string
      displayName: string
      globalPoints: number
      authenticated: boolean
    } | null
    RadioTEDUStudyBridge?: {
      apiBase: string
      request: typeof fetch
      account: StudyAccount
      globalPoints?: number
    } | null
    RadioTEDUStudyEntry?: StudyEntryConfig | null
  }
}
