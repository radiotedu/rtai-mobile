import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { RoomNavigationField, pointInPolygon } from '../src/pathfinding/RoomNavigationField'
import { buildMotionPath, sampleMotionPath } from '../src/game/PathMotion'
import { IMAGE_ROOMS, roomPointToPixel } from '../src/rooms/ImageRoomDefinition'
import { roomCatPatrolPoints } from '../src/rooms/RoomCatPatrols'
import { roomInteractionObstacles, roomNavigationGeometry } from '../src/rooms/RoomNavigationProfiles'
import { resolveSeatGeometry } from '../src/rooms/RoomSeatGeometry'

const ROOM_HASHES = Object.freeze({
  'library-wide.png': '50d1b58448c156cc6c47b823b450ffb26c43815ff6f346f27b6f1705b2d8c993',
  'chim-alan-wide.png': '84afe78fbf7fb502bea4646d402b638f4ade4e29969ed41fc6a103c2c5018ebf',
  'chim-alan-wide-360-restaurant-r3.png': '1875557012c754fd8f8e3a346dc31b5d8d003e530697bec6674ce08becc12310',
  'tedu-sports-center-wide.png': '4ad9bb8bbeb6a2a5ff55d15ef4a99b25872f4092d2fbf1ddc5e371f0c12e9313',
  'fatma-semih-akbil-auditorium-wide.png': '75c424a223515a3bd455c6a4c09694db28bd33dcdb472484ecb67da91454ff9c',
  'tedu-learning-lab-wide.png': '3a9dc739ad7d94a4a422c36a30841b8e6a417d8e1025ae69912c6eee5cc92bcc',
  'tedu-pedagogy-learning-lab-wide-r2.png': '572912669e48aaa3e72c1b6f532d28111566b854af7377d96b4516a1d4785e32',
})

describe('room navigation fields', () => {
  it('keeps the current room maps and the source-backed Çim revision byte-identical', async () => {
    for (const [filename, expected] of Object.entries(ROOM_HASHES)) {
      const bytes = await readFile(path.join(process.cwd(), 'public', 'assets', 'rooms', filename))
      expect(createHash('sha256').update(bytes).digest('hex'), filename).toBe(expected)
    }
  })

  for (const room of Object.values(IMAGE_ROOMS)) {
    it(`${room.id} exposes connected collision-safe floor routes`, () => {
      const geometry = roomNavigationGeometry(room)
      const field = new RoomNavigationField({
        width: room.image.width,
        height: room.image.height,
        geometry,
        clearance: 18,
      })
      const nodesByLayer = new Map<number, Array<(typeof room.nodes)[number]>>()
      for (const node of room.nodes.filter((candidate) => !candidate.id.startsWith('approach:'))) {
        nodesByLayer.set(node.z, [...(nodesByLayer.get(node.z) ?? []), node])
      }
      const blockedNamedNodes = room.nodes
        .filter((node) => !node.id.startsWith('approach:'))
        .flatMap((node) => {
          const point = roomPointToPixel(room, node)
          if (field.isWalkable(point, node.z)) return []
          return [`${node.id}: nearest=${JSON.stringify(field.nearestWalkable(point, node.z, 220))}`]
        })
      expect(blockedNamedNodes, `${room.id} has blocked compatibility nodes`).toEqual([])
      const spawn = room.nodes.find((node) => node.id === room.spawnNodeId)
      expect(spawn, `${room.id} spawn exists`).toBeDefined()
      expect(field.isWalkable(roomPointToPixel(room, spawn!), spawn!.z), `${room.id} spawn is blocked`).toBe(true)
      for (const [z, nodes] of nodesByLayer) {
        const safe = nodes
          .map((node) => ({ node, point: field.nearestWalkable(roomPointToPixel(room, node), z, 140) }))
          .filter((entry): entry is { node: (typeof nodes)[number]; point: { x: number; y: number } } => Boolean(entry.point))
        expect(safe.length, `${room.id} z=${z} needs two usable navigation anchors`).toBeGreaterThanOrEqual(Math.min(2, nodes.length))
        if (safe.length < 2) continue
        const route = field.findPath(safe[0]!.point, safe[safe.length - 1]!.point, z)
        expect(route.length, `${room.id} z=${z} route`).toBeGreaterThan(1)
        for (let index = 1; index < route.length; index += 1) {
          expect(field.segmentIsWalkable(route[index - 1]!, route[index]!, z), `${room.id} unsafe smoothed segment`).toBe(true)
        }
        for (const point of route) {
          expect(geometry.obstacles.some((polygon) => pointInPolygon(point, polygon)), `${room.id} obstacle intersection`).toBe(false)
        }
      }
    })

    it(`${room.id} resolves explicit geometry for every seat`, () => {
      const field = new RoomNavigationField({
        width: room.image.width,
        height: room.image.height,
        geometry: roomNavigationGeometry(room),
        clearance: 18,
      })
      const blockedApproaches: string[] = []
      const disconnectedApproaches: string[] = []
      for (const seat of room.seats) {
        const geometry = resolveSeatGeometry(room, seat)
        const approach = roomPointToPixel(room, geometry.approach)
        const nearestApproach = field.nearestWalkable(approach, geometry.approach.z, 220)
        expect(geometry.hitArea.length, seat.id).toBeGreaterThanOrEqual(4)
        expect(geometry.approach.x, seat.id).toBeGreaterThanOrEqual(0)
        expect(geometry.approach.x, seat.id).toBeLessThanOrEqual(100)
        expect(geometry.approach.y, seat.id).toBeGreaterThanOrEqual(0)
        expect(geometry.approach.y, seat.id).toBeLessThanOrEqual(100)
        // actorAnchor is authored against the visible chair component. The
        // legacy sit point remains stable for server compatibility and is not
        // a visual lower bound in the image-layer renderer.
        expect(geometry.actorAnchor.x, seat.id).toBeGreaterThanOrEqual(0)
        expect(geometry.actorAnchor.x, seat.id).toBeLessThanOrEqual(100)
        expect(geometry.actorAnchor.y, seat.id).toBeGreaterThanOrEqual(0)
        expect(geometry.actorAnchor.y, seat.id).toBeLessThanOrEqual(100)
        expect(geometry.actorAnchor.z, seat.id).toBe(seat.sit.z)
        if (!nearestApproach) blockedApproaches.push(`${seat.id}: no reachable approach cell`)
        const resolvedApproach = nearestApproach ?? approach
        const reachable = room.nodes
          .filter((node) => node.z === geometry.approach.z)
          .map((node) => field.nearestWalkable(roomPointToPixel(room, node), node.z, 140))
          .filter((point): point is { x: number; y: number } => Boolean(point))
          .some((point) => field.findPath(point, resolvedApproach, geometry.approach.z).length >= 2)
        if (!reachable) disconnectedApproaches.push(seat.id)
        for (const point of geometry.hitArea) {
          expect(point.x, `${seat.id} hit area x`).toBeGreaterThanOrEqual(0)
          expect(point.x, `${seat.id} hit area x`).toBeLessThanOrEqual(100)
          expect(point.y, `${seat.id} hit area y`).toBeGreaterThanOrEqual(0)
          expect(point.y, `${seat.id} hit area y`).toBeLessThanOrEqual(100)
        }
      }
      expect(blockedApproaches, `${room.id} has blocked seat approaches`).toEqual([])
      expect(disconnectedApproaches, `${room.id} has disconnected seat approaches`).toEqual([])
    })

    it(`${room.id} keeps cat patrols off furniture and seats`, () => {
      const base = roomNavigationGeometry(room)
      const seatObstacles = room.seats.map((seat) => (
        resolveSeatGeometry(room, seat).hitArea.map((point) => roomPointToPixel(room, point))
      ))
      const field = new RoomNavigationField({
        width: room.image.width,
        height: room.image.height,
        geometry: { ...base, obstacles: [...base.obstacles, ...seatObstacles] },
        clearance: 12,
      })
      const patrols = roomCatPatrolPoints(room)
      expect(patrols.length, `${room.id} patrol count`).toBeGreaterThanOrEqual(4)
      const blocked = patrols
        .filter((point) => !field.isWalkable(point, point.z))
        .map((point) => `${point.id}: nearest=${JSON.stringify(field.nearestWalkable(point, point.z, 220))}`)
      expect(blocked, `${room.id} blocked cat patrols`).toEqual([])
      for (const from of patrols) {
        for (const to of patrols) {
          if (from === to || from.z !== to.z) continue
          const route = field.findPath(from, to, from.z)
          expect(route.length, `${from.id} -> ${to.id}`).toBeGreaterThan(1)
          for (let segment = 1; segment < route.length; segment += 1) {
            expect(field.segmentIsWalkable(route[segment - 1]!, route[segment]!, from.z)).toBe(true)
          }
        }
      }
    })
  }

  it('keeps Auditorium movement in the authored cross-aisles and side aisles', () => {
    const room = IMAGE_ROOMS.auditorium
    const field = new RoomNavigationField({
      width: room.image.width,
      height: room.image.height,
      geometry: roomNavigationGeometry(room),
      clearance: 18,
    })
    const point = (x: number, y: number) => roomPointToPixel(room, { x, y })

    for (const [label, x, y] of [
      ['bottom cross-aisle', 50, 90],
      ['front cross-aisle', 80, 35],
      ['left side aisle', 9, 60],
      ['right-center aisle', 67, 68],
      ['right wall aisle', 93, 60],
    ] as const) {
      expect(field.isWalkable(point(x, y)), label).toBe(true)
    }
    for (const [label, x, y] of [
      ['left seating bank', 22, 62],
      ['center seating bank', 50, 62],
      ['right seating bank', 81, 62],
      ['left wall', 2, 22],
      ['rear wall', 50, 12],
    ] as const) {
      expect(field.isWalkable(point(x, y)), label).toBe(false)
    }
  })

  it('blocks every visible Library desk end without closing chair aisles', () => {
    const room = IMAGE_ROOMS.library
    const field = new RoomNavigationField({
      width: room.image.width,
      height: room.image.height,
      geometry: roomNavigationGeometry(room),
      clearance: 18,
    })
    const interactionObstacles = roomInteractionObstacles(room)
    const deskEndProbes = [
      { x: 1_135, y: 372 },
      { x: 950, y: 470 },
      { x: 770, y: 550 },
      { x: 535, y: 635 },
      { x: 1_250, y: 730 },
      { x: 1_035, y: 810 },
    ]

    const bodyClearanceProbes = [
      { x: 505, y: 661 },
    ]

    for (const point of [...deskEndProbes, ...bodyClearanceProbes]) {
      expect(field.isWalkable(point), JSON.stringify(point)).toBe(false)
      expect(interactionObstacles.some((polygon) => pointInPolygon(point, polygon)), JSON.stringify(point)).toBe(true)
    }
  })

  it('ships three transparent 32-frame cat walk sheets', async () => {
    for (const name of ['tarcin', 'benek', 'komur']) {
      const file = path.join(process.cwd(), 'public', 'assets', 'npcs', `campus-cat-${name}-walk.png`)
      const metadata = await sharp(file).metadata()
      expect(metadata).toMatchObject({ width: 1024, height: 1536, channels: 4, hasAlpha: true })
    }
  })

  it('replans the recorded Library redirect from each real interpolated position without snapping', () => {
    const room = IMAGE_ROOMS.library
    const field = new RoomNavigationField({
      width: room.image.width,
      height: room.image.height,
      geometry: roomNavigationGeometry(room),
      clearance: 18,
    })
    const spawnNode = room.nodes.find((node) => node.id === room.spawnNodeId)!
    const spawn = roomPointToPixel(room, spawnNode)
    const firstClick = { x: 825.69, y: 511.14 }
    const redirectedClick = { x: 596.33, y: 655.31 }
    const firstRoute = field.findPath(spawn, firstClick)
    const firstMotion = buildMotionPath(firstRoute.map((point, index) => ({ id: `first:${index}`, ...point, z: 0 })))

    for (let distance = 0; distance <= firstMotion.totalLength; distance += 12) {
      const current = sampleMotionPath(firstMotion, distance)
      const route = field.findPath(current, redirectedClick)
      expect(route.length, `retarget at ${distance}px`).toBeGreaterThan(1)
      expect(route[0]!.x, `retarget x at ${distance}px`).toBeCloseTo(current.x, 5)
      expect(route[0]!.y, `retarget y at ${distance}px`).toBeCloseTo(current.y, 5)
      for (let segment = 1; segment < route.length; segment += 1) {
        expect(field.segmentIsWalkable(route[segment - 1]!, route[segment]!), `unsafe retarget segment at ${distance}px`).toBe(true)
      }
    }
  })
})
