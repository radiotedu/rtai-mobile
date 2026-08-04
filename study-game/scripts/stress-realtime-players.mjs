import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifactDir = path.resolve(projectDir, '..', 'artifacts', 'study-game', 'stress')
const playerCount = Number.parseInt(process.env.STRESS_PLAYERS ?? '60', 10)
const walkRounds = Number.parseInt(process.env.STRESS_WALK_ROUNDS ?? '3', 10)
const apiPort = Number.parseInt(process.env.STRESS_API_PORT ?? '4191', 10)
const artificialLatencyMs = Number.parseInt(process.env.STRESS_LATENCY_MS ?? '25', 10)
const capacity = Math.max(90, playerCount)
const apiOrigin = `http://127.0.0.1:${apiPort}`

if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 100) {
  throw new Error('STRESS_PLAYERS must be an integer between 2 and 100')
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const percentile = (values, fraction) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
}
const round = (value, digits = 1) => Number(value.toFixed(digits))
const readJson = async (request) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

const players = new Map()
const messages = []
const serverMetrics = {
  requests: 0,
  errors: 0,
  concurrent: 0,
  maxConcurrent: 0,
  movementUpdates: 0,
  latenciesMs: [],
  routes: {},
}

const presenceFor = (roomId, instanceId) => [...players.values()]
  .filter((player) => player.roomId === roomId && player.instanceId === instanceId)
  .map((player) => ({
    userId: player.id,
    displayName: player.displayName,
    roomId,
    instanceId,
    nodeId: player.nodeId,
    seatId: null,
    equipped: {},
  }))

const apiServer = createServer(async (request, response) => {
  const startedAt = performance.now()
  serverMetrics.requests += 1
  serverMetrics.concurrent += 1
  serverMetrics.maxConcurrent = Math.max(serverMetrics.maxConcurrent, serverMetrics.concurrent)
  const url = new URL(request.url ?? '/', apiOrigin)
  const routeKey = `${request.method ?? 'GET'} ${url.pathname}`
  serverMetrics.routes[routeKey] = (serverMetrics.routes[routeKey] ?? 0) + 1

  try {
    await delay(artificialLatencyMs + (serverMetrics.requests % 11))
    const playerId = String(request.headers['x-load-player'] ?? '')
    const displayName = `Load ${playerId.replace('load-player-', '').padStart(2, '0')}`

    if (url.pathname === '/health') {
      sendJson(response, 200, { ok: true })
    } else if (url.pathname === '/study/instances/join' && request.method === 'POST') {
      const body = await readJson(request)
      const roomId = typeof body.roomId === 'string' ? body.roomId : 'library'
      const instanceId = `${roomId}-1`
      players.set(playerId, {
        id: playerId,
        displayName,
        roomId,
        instanceId,
        nodeId: typeof body.nodeId === 'string' ? body.nodeId : 'entrance',
        lastSeenAt: Date.now(),
        movementUpdates: 0,
      })
      sendJson(response, 200, {
        success: true,
        data: { instance: { id: instanceId, roomId, number: 1, occupancy: presenceFor(roomId, instanceId).length, capacity } },
      })
    } else if (url.pathname === '/study/presence/heartbeat' && request.method === 'POST') {
      const body = await readJson(request)
      const current = players.get(playerId)
      if (!current || current.instanceId !== body.instanceId) {
        sendJson(response, 409, { success: false, error: 'STALE_INSTANCE' })
      } else {
        if (typeof body.nodeId === 'string' && current.nodeId !== body.nodeId) {
          current.nodeId = body.nodeId
          current.movementUpdates += 1
          serverMetrics.movementUpdates += 1
        }
        current.lastSeenAt = Date.now()
        sendJson(response, 200, { success: true, data: {} })
      }
    } else if (url.pathname === '/study/presence' && request.method === 'GET') {
      const roomId = url.searchParams.get('roomId') ?? 'library'
      const instanceId = url.searchParams.get('instanceId') ?? `${roomId}-1`
      sendJson(response, 200, { success: true, data: { presence: presenceFor(roomId, instanceId) } })
    } else if (url.pathname === '/study/chat' && request.method === 'POST') {
      const body = await readJson(request)
      const player = players.get(playerId)
      if (!player || player.instanceId !== body.instanceId || player.roomId !== body.roomId) {
        sendJson(response, 403, { success: false, error: 'NOT_IN_ROOM' })
      } else {
        const message = {
          id: `stress-message-${messages.length + 1}`,
          userId: playerId,
          displayName: player.displayName,
          roomId: player.roomId,
          instanceId: player.instanceId,
          text: String(body.text ?? '').slice(0, 180),
          createdAt: new Date().toISOString(),
        }
        messages.push(message)
        sendJson(response, 200, { success: true, data: { message } })
      }
    } else if (url.pathname === '/study/chat' && request.method === 'GET') {
      const roomId = url.searchParams.get('roomId') ?? 'library'
      const instanceId = url.searchParams.get('instanceId') ?? `${roomId}-1`
      sendJson(response, 200, { success: true, data: { messages: messages.filter((item) => item.roomId === roomId && item.instanceId === instanceId) } })
    } else {
      serverMetrics.errors += 1
      sendJson(response, 404, { success: false, error: `Unhandled stress endpoint: ${routeKey}` })
    }
  } catch (error) {
    serverMetrics.errors += 1
    sendJson(response, 500, { success: false, error: error instanceof Error ? error.message : String(error) })
  } finally {
    serverMetrics.concurrent -= 1
    serverMetrics.latenciesMs.push(performance.now() - startedAt)
  }
})

const requestErrors = []
const request = async (playerId, pathName, init = {}) => {
  const startedAt = performance.now()
  try {
    const response = await fetch(`${apiOrigin}${pathName}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Load-Player': playerId,
        ...(init.headers ?? {}),
      },
    })
    const payload = await response.json()
    if (!response.ok || payload.success === false) throw new Error(payload.error ?? `HTTP ${response.status}`)
    return { payload, latencyMs: performance.now() - startedAt }
  } catch (error) {
    requestErrors.push({ playerId, path: pathName, error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

await new Promise((resolve, reject) => {
  apiServer.once('error', reject)
  apiServer.listen(apiPort, '127.0.0.1', resolve)
})

const overallStartedAt = performance.now()
const playerIds = Array.from({ length: playerCount }, (_, index) => `load-player-${index + 1}`)
const clientLatenciesMs = []
const nodes = ['central-aisle', 'front-left', 'upper-right', 'lounge-entry']

try {
  const joinResults = await Promise.all(playerIds.map((playerId) => request(playerId, '/study/instances/join', {
    method: 'POST',
    body: JSON.stringify({ roomId: 'library', nodeId: 'entrance' }),
  })))
  clientLatenciesMs.push(...joinResults.map((result) => result.latencyMs))

  for (let roundIndex = 0; roundIndex < walkRounds; roundIndex += 1) {
    const heartbeatResults = await Promise.all(playerIds.map((playerId, index) => request(playerId, '/study/presence/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'library',
        instanceId: 'library-1',
        nodeId: nodes[(index + roundIndex + 1) % nodes.length],
        position: { x: (index * 37 + roundIndex * 19) % 1920, y: (index * 23 + roundIndex * 31) % 1080 },
      }),
    })))
    clientLatenciesMs.push(...heartbeatResults.map((result) => result.latencyMs))

    const presenceResults = await Promise.all(playerIds.map((playerId) => request(
      playerId,
      '/study/presence?roomId=library&instanceId=library-1',
    )))
    clientLatenciesMs.push(...presenceResults.map((result) => result.latencyMs))
    if (presenceResults.some((result) => result.payload.data.presence.length !== playerCount)) {
      throw new Error('A client did not receive the complete room presence')
    }
    await delay(250)
  }

  const chatResults = await Promise.all(playerIds.map((playerId, index) => request(playerId, '/study/chat', {
    method: 'POST',
    body: JSON.stringify({ roomId: 'library', instanceId: 'library-1', text: `Study check-in ${index + 1}` }),
  })))
  clientLatenciesMs.push(...chatResults.map((result) => result.latencyMs))

  const finalPresence = await request(playerIds[0], '/study/presence?roomId=library&instanceId=library-1')
  const finalChat = await request(playerIds[0], '/study/chat?roomId=library&instanceId=library-1')
  const freshHeartbeatCount = [...players.values()].filter((player) => Date.now() - player.lastSeenAt < 15_000).length
  const movedPlayerCount = [...players.values()].filter((player) => player.movementUpdates >= walkRounds).length
  const expectedWalks = playerCount * walkRounds
  const passed = players.size === playerCount
    && finalPresence.payload.data.presence.length === playerCount
    && finalChat.payload.data.messages.length === playerCount
    && freshHeartbeatCount === playerCount
    && movedPlayerCount === playerCount
    && serverMetrics.movementUpdates === expectedWalks
    && serverMetrics.errors === 0
    && requestErrors.length === 0

  const report = {
    status: passed ? 'passed' : 'failed',
    generatedAt: new Date().toISOString(),
    mode: 'protocol-realtime',
    note: 'No headless browser is used. Visual rendering is covered by the separate desktop/mobile Playwright evidence suite.',
    durationSeconds: round((performance.now() - overallStartedAt) / 1_000, 2),
    clients: {
      requested: playerCount,
      joined: players.size,
      peersVisiblePerClient: finalPresence.payload.data.presence.length - 1,
      roomOccupancy: finalPresence.payload.data.presence.length,
      capacity,
      walkRounds,
      requestedWalkingOperations: expectedWalks,
      acceptedMovementUpdates: serverMetrics.movementUpdates,
      movedPlayers: movedPlayerCount,
      freshHeartbeats: freshHeartbeatCount,
      chatMessages: finalChat.payload.data.messages.length,
    },
    realtime: {
      requests: serverMetrics.requests,
      requestErrors: requestErrors.length,
      serverErrors: serverMetrics.errors,
      maxConcurrentRequests: serverMetrics.maxConcurrent,
      latencyMedianMs: round(percentile(clientLatenciesMs, 0.5)),
      latencyP95Ms: round(percentile(clientLatenciesMs, 0.95)),
      routes: serverMetrics.routes,
    },
    failures: requestErrors.slice(0, 20),
  }

  await mkdir(artifactDir, { recursive: true })
  const reportPath = path.join(artifactDir, `stress-${playerCount}-players-report.json`)
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ status: report.status, reportPath, ...report.clients, ...report.realtime }, null, 2))
  if (!passed) process.exitCode = 1
} catch (error) {
  await mkdir(artifactDir, { recursive: true })
  const failurePath = path.join(artifactDir, `stress-${playerCount}-players-failure.json`)
  const failure = {
    status: 'failed',
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    joined: players.size,
    requestErrors: requestErrors.slice(0, 20),
  }
  await writeFile(failurePath, `${JSON.stringify(failure, null, 2)}\n`, 'utf8')
  console.error(JSON.stringify({ failurePath, ...failure }, null, 2))
  process.exitCode = 1
} finally {
  await new Promise((resolve) => apiServer.close(resolve))
}
