import Phaser from 'phaser'

import { LocalStudyAdapter } from '../adapters/LocalStudyAdapter'
import type { StudyAdapter, StudyChatMessage, StudyPresence } from '../adapters/StudyAdapter'
import { DIRECTIONS, type AvatarAction, type AvatarAppearance, type AvatarLayerSlot, type Direction8 } from '../avatar/AvatarAppearance'
import { DEFAULT_AVATAR_ASSET_MANIFEST } from '../avatar/AvatarAssetManifest'
import { resolveInitialAvatarAppearance } from '../avatar/InitialAvatarAppearance'
import { avatarUpperBodyCrop, canonicalAvatarTextureKey, shouldUseCanonicalAvatar } from '../avatar/AvatarPresentation'
import { InventoryStore } from '../inventory/InventoryStore'
import { WearableCatalog, type WardrobeItem, type WardrobeSlot } from '../inventory/WearableCatalog'
import { WardrobeController } from '../inventory/WardrobeController'
import { NavigationGraph, type NavigationNode } from '../pathfinding/NavigationGraph'
import { smoothNavigationRoute } from '../pathfinding/RouteSmoother'
import { IMAGE_ROOMS, roomPointToPixel, type ImageRoomDefinition, type ImageRoomId, type ImageRoomSeat } from '../rooms/ImageRoomDefinition'
import type { StudySessionTracker } from '../session/StudySessionTracker'
import { StudyPresenceLoop } from '../session/StudyPresenceLoop'
import { AvatarController } from './AvatarController'
import { AvatarActivityMachine, type ActivityToken } from './AvatarActivityMachine'
import { calculateOverviewZoom, calculatePlayableZoom } from './CameraFraming'
import { imageRoomActorDepth } from './ImageRoomDepth'
import { buildMotionPath, sampleMotionPathAtTime, walkFrameAtDistance } from './PathMotion'
import { SeatReservationBook } from './SeatReservationBook'
import { resolveTouchIntent, type TouchWorldPoint } from './TouchIntentResolver'

const ACTION_FRAMES: Record<AvatarAction, number> = { idle: 1, walk: 4, sit: 1, stand: 3 }
const RENDERED_LAYERS: AvatarLayerSlot[] = ['body', 'skin', 'hair', 'top', 'bottom', 'shoes', 'hat']
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/avatars/engine-proof`
const CAMPUS_CAT_ASSETS = ['campus-cat-tarcin.png', 'campus-cat-benek.png', 'campus-cat-komur.png'] as const
const ROOM_BASE = import.meta.env.BASE_URL
const SUPPORTED_ITEMS = ['short-hair', 'radio-hoodie', 'varsity-jacket', 'jeans', 'black-cargos', 'sneakers', 'boots', 'bucket-hat', 'beanie'] as const
const AVATAR_WALK_SPEED = 280
const AVATAR_WALK_STRIDE = 18
const CAMPUS_CAT_NAMES = ['Tarçın', 'Benek', 'Kömür'] as const
const CAMPUS_CAT_COUNTS: Readonly<Record<ImageRoomId, number>> = Object.freeze({
  library: 1,
  'chim-alan': 2,
  'sports-center': 1,
  auditorium: 1,
})

type CampusCat = {
  name: (typeof CAMPUS_CAT_NAMES)[number]
  nodeId: string
  roomId: ImageRoomId
  sprite: Phaser.GameObjects.Sprite
}

type GameState = 'ready' | 'walking' | 'stair' | 'sitting' | 'seated' | 'standing' | 'spark' | 'rock'

const DEFAULT_APPEARANCE: AvatarAppearance = Object.freeze({
  bodyType: 'masc',
  skinTone: 'warm',
  hairId: 'short-hair',
  hairColor: 'brown',
  topId: 'radio-hoodie',
  bottomId: 'black-cargos',
  shoesId: 'sneakers',
  hatId: 'bucket-hat',
  accessoryId: null,
})

const FACING_DELTA: Record<Direction8, { x: number; y: number }> = {
  n: { x: 0, y: -1 }, ne: { x: 1, y: -1 }, e: { x: 1, y: 0 }, se: { x: 1, y: 1 },
  s: { x: 0, y: 1 }, sw: { x: -1, y: 1 }, w: { x: -1, y: 0 }, nw: { x: -1, y: -1 },
}

function textureFile(layer: AvatarLayerSlot, action: AvatarAction, appearance: AvatarAppearance): string | null {
  if (layer === 'body' || layer === 'skin' || layer === 'hair') return `${layer}-${action}.png`
  if (layer === 'top') return `top-${appearance.topId}-${action}.png`
  if (layer === 'bottom') return `bottom-${appearance.bottomId}-${action}.png`
  if (layer === 'shoes') return `shoes-${appearance.shoesId}-${action}.png`
  if (layer === 'hat' && appearance.hatId) return `hat-${appearance.hatId}-${action}.png`
  return null
}

function textureKey(layer: AvatarLayerSlot, action: AvatarAction, appearance: AvatarAppearance): string | null {
  const file = textureFile(layer, action, appearance)
  return file ? `avatar:${file.slice(0, -4)}` : null
}

function appearanceForPresence(presence: StudyPresence): AvatarAppearance {
  const appearance = { ...DEFAULT_APPEARANCE }
  for (const id of presence.equippedWearableIds ?? []) {
    if (['short-hair'].includes(id)) appearance.hairId = id
    if (['radio-hoodie', 'varsity-jacket'].includes(id)) appearance.topId = id
    if (['jeans', 'black-cargos'].includes(id)) appearance.bottomId = id
    if (['sneakers', 'boots'].includes(id)) appearance.shoesId = id
    if (['bucket-hat', 'beanie'].includes(id)) appearance.hatId = id
  }
  return appearance
}

export class ImageRoomScene extends Phaser.Scene {
  #roomId: ImageRoomId = 'library'
  #room: ImageRoomDefinition = IMAGE_ROOMS.library
  #graph = new NavigationGraph(this.#room.nodes, this.#room.edges)
  #currentNodeId = this.#room.spawnNodeId
  #state: GameState = 'ready'
  #activity = new AvatarActivityMachine()
  #seatReservations = new SeatReservationBook()
  #routeTween: Phaser.Tweens.Tween | null = null
  #activeSegmentFromId: string | null = null
  #activeSegmentToId: string | null = null
  #seatTransitionPromise: Promise<void> | null = null
  #standPromise: Promise<void> | null = null
  #seatedSeat: ImageRoomSeat | null = null
  #background!: Phaser.GameObjects.Image
  #avatar!: Phaser.GameObjects.Container
  #canonicalAvatar!: Phaser.GameObjects.Sprite
  #seatedUpperAvatar!: Phaser.GameObjects.Container
  #seatedUpperCanonical!: Phaser.GameObjects.Sprite
  #shadow!: Phaser.GameObjects.Ellipse
  #avatarSprites = new Map<AvatarLayerSlot, Phaser.GameObjects.Sprite>()
  #seatedUpperSprites = new Map<AvatarLayerSlot, Phaser.GameObjects.Sprite>()
  #avatarController!: AvatarController
  #wardrobe!: WardrobeController
  #wearableOperations = new Map<string, Promise<void>>()
  #roomObjects: Phaser.GameObjects.GameObject[] = []
  #seatForegroundObjects: Phaser.GameObjects.GameObject[] = []
  #socialObjects: Phaser.GameObjects.GameObject[] = []
  #campusCats: CampusCat[] = []
  #chatBubbles = new Map<string, Phaser.GameObjects.Container>()
  #auditoriumScreenEvent: Phaser.Time.TimerEvent | null = null
  #intentMarker: Phaser.GameObjects.GameObject | null = null
  #keyboardHandler = (event: KeyboardEvent): void => {
    const target = event.target
    if (target instanceof HTMLElement && (
      target.isContentEditable
      || target.matches('input, textarea, select, button')
    )) return

    const direction = new Map<string, { x: number; y: number }>([
      ['arrowup', { x: 0, y: -1 }],
      ['w', { x: 0, y: -1 }],
      ['arrowdown', { x: 0, y: 1 }],
      ['s', { x: 0, y: 1 }],
      ['arrowleft', { x: -1, y: 0 }],
      ['a', { x: -1, y: 0 }],
      ['arrowright', { x: 1, y: 0 }],
      ['d', { x: 1, y: 0 }],
    ]).get(event.key.toLowerCase())
    if (!direction) return
    event.preventDefault()
    void this.moveByDirection(direction.x, direction.y)
  }
  #chatMessageHandler = (event: Event): void => {
    const detail = (event as CustomEvent<{ message: StudyChatMessage; roomId: ImageRoomId }>).detail
    if (!detail?.message || detail.roomId !== this.#roomId) return
    this.#showChatBubble(detail.message)
  }
  #ignoreChangedHandler = (event: Event): void => {
    const detail = (event as CustomEvent<{ userId: string; ignored: boolean }>).detail
    if (!detail?.ignored) return
    this.#chatBubbles.get(detail.userId)?.destroy()
    this.#chatBubbles.delete(detail.userId)
  }
  #presenceRefreshBusy = false
  #presenceLoop: StudyPresenceLoop | null = null
  readonly #adapter: StudyAdapter
  readonly #initialRoom: ImageRoomId
  readonly #sessionTracker?: StudySessionTracker

  constructor(adapter: StudyAdapter = new LocalStudyAdapter(), initialRoom: ImageRoomId = 'library', sessionTracker?: StudySessionTracker) {
    super('image-rooms')
    this.#adapter = adapter
    this.#initialRoom = initialRoom
    this.#sessionTracker = sessionTracker
  }

  preload(): void {
    CAMPUS_CAT_ASSETS.forEach((asset, index) => {
      this.load.image(`campus-cat:${index}`, `${import.meta.env.BASE_URL}assets/npcs/${asset}`)
    })
    for (const room of Object.values(IMAGE_ROOMS)) {
      this.load.image(`room:${room.id}`, `${ROOM_BASE}${room.image.url}`)
      for (const occluder of room.occluders) {
        this.load.image(`occluder:${room.id}:${occluder.id}`, `${ROOM_BASE}${occluder.asset.url}`)
      }
      for (const seat of room.seats) {
        if (seat.foregroundAsset) {
          this.load.image(`seat-foreground:${room.id}:${seat.id}`, `${ROOM_BASE}${seat.foregroundAsset.url}`)
        }
      }
    }
    for (const action of Object.keys(ACTION_FRAMES) as AvatarAction[]) {
      this.load.spritesheet(canonicalAvatarTextureKey(action), `${ASSET_BASE}/canonical-${action}.png`, {
        frameWidth: 64, frameHeight: 96, endFrame: DIRECTIONS.length * ACTION_FRAMES[action] - 1,
      })
      for (const layer of ['body', 'skin', 'hair'] as const) {
        this.load.spritesheet(`avatar:${layer}-${action}`, `${ASSET_BASE}/${layer}-${action}.png`, {
          frameWidth: 64, frameHeight: 96, endFrame: DIRECTIONS.length * ACTION_FRAMES[action] - 1,
        })
      }
      for (const [slot, ids] of Object.entries({
        top: ['radio-hoodie', 'varsity-jacket'],
        bottom: ['jeans', 'black-cargos'],
        shoes: ['sneakers', 'boots'],
        hat: ['bucket-hat', 'beanie'],
      })) {
        for (const id of ids) {
          const file = `${slot}-${id}-${action}`
          this.load.spritesheet(`avatar:${file}`, `${ASSET_BASE}/${file}.png`, {
            frameWidth: 64, frameHeight: 96, endFrame: DIRECTIONS.length * ACTION_FRAMES[action] - 1,
          })
        }
      }
    }
  }

  create(): void {
    const catalogItems = Object.values(DEFAULT_AVATAR_ASSET_MANIFEST.wearables)
      .flat()
      .filter((item) => SUPPORTED_ITEMS.includes(item.id as (typeof SUPPORTED_ITEMS)[number])) as WardrobeItem[]
    const catalog = new WearableCatalog(catalogItems)
    const storage = {
      getItem: (key: string) => window.localStorage.getItem(key),
      setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
    }
    const session = this.#adapter.session()
    const inventory = new InventoryStore(catalog, storage, session.ownedWearableIds, {
      authoritativeEquipped: this.#adapter.authoritativeInventory
        ? session.equippedWearableIds
        : undefined,
    })
    const appearance = resolveInitialAvatarAppearance(DEFAULT_APPEARANCE, catalog, inventory)
    this.#wardrobe = new WardrobeController(catalog, inventory, appearance)
    this.#avatarController = new AvatarController(DEFAULT_AVATAR_ASSET_MANIFEST, this.#wardrobe.appearance)

    this.#createAvatar()
    this.#renderRoom(this.#initialRoom)
    this.#bindPointerMovement()
    this.#bindKeyboardMovement()
    this.#bindHud()
    this.#exposeDebugApi()
    this.#presenceLoop = new StudyPresenceLoop(
      () => this.#pushPresence(),
      () => this.#refreshSocialActors(),
    )
    this.#presenceLoop.start()
    window.addEventListener('radiotedu:study-chat-message', this.#chatMessageHandler)
    window.addEventListener('radiotedu:study-ignore-changed', this.#ignoreChangedHandler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#presenceLoop?.stop()
      this.#presenceLoop = null
      const ownerId = this.#adapter.session().account.id
      if (this.#seatReservations.releaseOwner(ownerId) > 0) void this.#adapter.releaseSeat()
      void this.#sessionTracker?.stood().catch(() => undefined)
      window.removeEventListener('keydown', this.#keyboardHandler)
      window.removeEventListener('radiotedu:study-chat-message', this.#chatMessageHandler)
      window.removeEventListener('radiotedu:study-ignore-changed', this.#ignoreChangedHandler)
    })
    this.scale.on(Phaser.Scale.Events.RESIZE, this.#fitCamera, this)
    document.documentElement.dataset.studyReady = 'true'
  }

  #createAvatar(): void {
    this.#shadow = this.add.ellipse(0, 0, 38, 14, 0x020609, 0.42)
    this.#avatar = this.add.container(0, 0).setScale(1.08)
    this.#seatedUpperAvatar = this.add.container(0, 0).setScale(1.08).setVisible(false)
    this.#canonicalAvatar = this.add.sprite(0, 0, canonicalAvatarTextureKey('idle')).setOrigin(0.5, 0.88)
    this.#seatedUpperCanonical = this.add.sprite(0, 0, canonicalAvatarTextureKey('sit')).setOrigin(0.5, 0.88)
    for (const layer of RENDERED_LAYERS) {
      const key = textureKey(layer, 'idle', this.#avatarController.appearance)
      if (!key) continue
      const sprite = this.add.sprite(0, 0, key).setOrigin(0.5, 0.88)
      const seatedUpperSprite = this.add.sprite(0, 0, key).setOrigin(0.5, 0.88)
      this.#avatarSprites.set(layer, sprite)
      this.#seatedUpperSprites.set(layer, seatedUpperSprite)
    }
    this.#updateAvatarFrame(0)
  }

  #clearRoomObjects(): void {
    this.#auditoriumScreenEvent?.remove(false)
    this.#auditoriumScreenEvent = null
    delete document.documentElement.dataset.auditoriumScreen
    for (const object of [...this.#roomObjects, ...this.#seatForegroundObjects, ...this.#socialObjects]) object.destroy()
    this.#roomObjects = []
    this.#seatForegroundObjects = []
    this.#socialObjects = []
    this.#campusCats = []
    this.#chatBubbles.clear()
    delete document.documentElement.dataset.campusCats
    delete document.documentElement.dataset.lastCampusCat
    delete document.documentElement.dataset.chatBubble
    delete document.documentElement.dataset.chatSpeaker
  }

  #showChatBubble(message: StudyChatMessage): void {
    const accountId = this.#adapter.session().account.id
    let anchor = message.userId === accountId
      ? { x: this.#avatar.x, y: this.#avatar.y }
      : null
    if (!anchor) {
      const presence = this.#adapter.presence(this.#roomId).find((person) => person.userId === message.userId)
      if (!presence) return
      const seat = presence.seatId ? this.#room.seats.find((candidate) => candidate.id === presence.seatId) : null
      const node = this.#graph.node(presence.nodeId)
      if (!seat && !node) return
      anchor = roomPointToPixel(this.#room, seat?.sit ?? node!)
    }

    this.#chatBubbles.get(message.userId)?.destroy()
    const safeText = message.text.slice(0, 180)
    const name = this.add.text(0, 0, message.displayName, {
      color: '#1c5546', fontFamily: 'Segoe UI, sans-serif', fontSize: '11px', fontStyle: 'bold',
    })
    const body = this.add.text(0, 16, safeText, {
      color: '#17201e', fontFamily: 'Segoe UI, sans-serif', fontSize: '13px',
      lineSpacing: 2, wordWrap: { width: 210, useAdvancedWrap: true },
    })
    const bubbleWidth = Phaser.Math.Clamp(Math.max(name.width, body.width) + 22, 92, 232)
    const bubbleHeight = body.height + 36
    name.setX(-bubbleWidth / 2 + 11)
    body.setX(-bubbleWidth / 2 + 11)
    const background = this.add.graphics()
    background.fillStyle(0xf7fbf8, 0.98).fillRoundedRect(-bubbleWidth / 2, -8, bubbleWidth, bubbleHeight, 8)
    background.lineStyle(2, 0x263d37, 1).strokeRoundedRect(-bubbleWidth / 2, -8, bubbleWidth, bubbleHeight, 8)
    background.fillStyle(0xf7fbf8, 0.98).fillTriangle(-7, bubbleHeight - 8, 7, bubbleHeight - 8, 0, bubbleHeight + 3)
    const container = this.add.container(anchor.x, anchor.y - bubbleHeight - 100, [background, name, body])
      .setDepth(900_000_000)
    this.#chatBubbles.set(message.userId, container)
    this.#roomObjects.push(container)
    document.documentElement.dataset.chatBubble = safeText
    document.documentElement.dataset.chatSpeaker = message.displayName

    this.time.delayedCall(4_500, () => {
      if (!container.active) return
      this.tweens.add({
        targets: container,
        alpha: 0,
        y: container.y - 10,
        duration: 220,
        onComplete: () => {
          if (this.#chatBubbles.get(message.userId) === container) this.#chatBubbles.delete(message.userId)
          if (document.documentElement.dataset.chatBubble === safeText) {
            delete document.documentElement.dataset.chatBubble
            delete document.documentElement.dataset.chatSpeaker
          }
          container.destroy()
        },
      })
    })
  }

  #renderRoom(roomId: ImageRoomId): void {
    this.#activity.cancel()
    this.#routeTween?.stop()
    this.#routeTween = null
    this.#clearIntentMarker()
    this.tweens.killTweensOf([this.#avatar, this.#shadow])
    this.#clearRoomObjects()
    this.#roomId = roomId
    this.#room = IMAGE_ROOMS[roomId]
    this.#graph = new NavigationGraph(this.#room.nodes, this.#room.edges)
    this.#currentNodeId = this.#room.spawnNodeId
    this.#seatedSeat = null

    this.#background = this.add.image(0, 0, `room:${roomId}`).setOrigin(0).setDepth(-100_000)
    this.#roomObjects.push(this.#background)
    if (roomId === 'auditorium') this.#createAuditoriumEventScreen()
    this.#createOcclusionLayers()
    this.#createWorldActors()
    this.#createSocialActors()
    this.#createCampusCats()

    const spawn = this.#graph.node(this.#currentNodeId)!
    const pixel = roomPointToPixel(this.#room, spawn)
    this.#avatar.setPosition(pixel.x, pixel.y)
    this.#seatedUpperAvatar.setPosition(pixel.x, pixel.y).setVisible(false)
    this.#shadow.setPosition(pixel.x, pixel.y + 5).setVisible(true)
    this.#setAvatarDepth(spawn)
    this.#avatarController.applyMovement({ x: 0, y: 0 })
    this.#updateAvatarFrame(0)
    void Promise.resolve(this.#adapter.enterRoom(this.#roomId, this.#currentNodeId)).catch(() => {
      if (this.#roomId === roomId) this.#showActionError('ROOM UNAVAILABLE')
    })

    this.cameras.main.stopFollow()
    this.cameras.main.removeBounds()
    this.#fitCamera()
    this.#setState('ready')
    this.#syncHud()
    window.dispatchEvent(new CustomEvent('radiotedu:study-room-changed', { detail: { roomId: this.#roomId } }))
    void this.#pushPresence()
  }

  #fitCamera(): void {
    const viewport = this.scale.gameSize
    const desktopStage = viewport.width / viewport.height >= 1.45
    const zoom = desktopStage
      ? calculateOverviewZoom(viewport, this.#room.image)
      : calculatePlayableZoom(viewport, this.#room.image)
    const camera = this.cameras.main
    camera.stopFollow()
    camera.removeBounds()
    if (!desktopStage) {
      camera.setBounds(0, 0, this.#room.image.width, this.#room.image.height)
      camera.setZoom(zoom)
      camera.startFollow(this.#avatar, true, 0.12, 0.12)
      camera.centerOn(this.#avatar.x, this.#avatar.y)
      return
    }
    camera.setZoom(zoom)
    camera.centerOn(this.#room.image.width / 2, this.#room.image.height / 2)
  }

  #createOcclusionLayers(): void {
    for (const occluder of this.#room.occluders) {
      const image = this.add.image(occluder.asset.x, occluder.asset.y, `occluder:${this.#roomId}:${occluder.id}`).setOrigin(0)
      image.setDepth(occluder.depthY * 100)
      this.#roomObjects.push(image)
    }
  }

  #createCampusCats(): void {
    const reservedNodes = new Set([
      this.#room.spawnNodeId,
      ...this.#room.seats.flatMap((seat) => [seat.approachNodeId]),
    ])
    const candidates = this.#room.nodes.filter((node) => !reservedNodes.has(node.id))
    const fallback = this.#room.nodes.filter((node) => node.id !== this.#room.spawnNodeId)
    const available = candidates.length > 0 ? candidates : fallback
    const count = Math.min(CAMPUS_CAT_COUNTS[this.#roomId], available.length)
    const remaining = [...available]

    for (let index = 0; index < count; index += 1) {
      const candidateIndex = Phaser.Math.Between(0, Math.max(0, remaining.length - 1))
      const [node] = remaining.splice(candidateIndex, 1)
      if (!node) break
      const pixel = roomPointToPixel(this.#room, node)
      const name = CAMPUS_CAT_NAMES[(index + this.#room.id.length) % CAMPUS_CAT_NAMES.length]!
      const sprite = this.add.sprite(pixel.x, pixel.y, `campus-cat:${CAMPUS_CAT_NAMES.indexOf(name)}`)
        .setOrigin(0.5, 0.88)
        .setScale(0.35)
        .setDepth(node.y * 100 + 45)
        .setInteractive({ useHandCursor: true })
      const cat: CampusCat = { name, nodeId: node.id, roomId: this.#roomId, sprite }
      sprite.setData('campusCatName', name)
      sprite.on('pointerdown', (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        this.#showCampusCatGreeting(cat)
      })
      this.#campusCats.push(cat)
      this.#roomObjects.push(sprite)
      this.#scheduleCampusCatWander(cat)
    }

    document.documentElement.dataset.campusCats = String(this.#campusCats.length)
  }

  #scheduleCampusCatWander(cat: CampusCat): void {
    this.time.delayedCall(Phaser.Math.Between(1_800, 4_800), () => {
      if (!cat.sprite.active || cat.roomId !== this.#roomId) return
      const neighbors = this.#graph.neighbors(cat.nodeId)
      if (neighbors.length === 0) return
      const target = Phaser.Utils.Array.GetRandom([...neighbors])
      const pixel = roomPointToPixel(this.#room, target)
      cat.sprite.setFlipX(pixel.x < cat.sprite.x)
      this.tweens.add({
        targets: cat.sprite,
        x: pixel.x,
        y: pixel.y,
        duration: Phaser.Math.Between(1_350, 2_350),
        ease: 'Sine.InOut',
        onUpdate: () => cat.sprite.setDepth(cat.sprite.y * 100 + 45),
        onComplete: () => {
          cat.nodeId = target.id
          this.#scheduleCampusCatWander(cat)
        },
      })
    })
  }

  #showCampusCatGreeting(cat: CampusCat): void {
    if (!cat.sprite.active) return
    document.documentElement.dataset.lastCampusCat = cat.name
    const copy = this.add.text(0, 0, `${cat.name}\nCampus cat · purrs softly`, {
      align: 'center',
      color: '#17201e',
      fontFamily: 'Segoe UI, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      lineSpacing: 3,
      padding: { x: 9, y: 7 },
      backgroundColor: '#f7fbf8',
    }).setOrigin(0.5, 1)
    const bubble = this.add.container(cat.sprite.x, cat.sprite.y - 76, [copy]).setDepth(900_000_000)
    this.#roomObjects.push(bubble)
    this.tweens.add({
      targets: bubble,
      alpha: 0,
      y: bubble.y - 8,
      delay: 1_500,
      duration: 240,
      onComplete: () => bubble.destroy(),
    })
  }

  #createWorldActors(): void {
    for (const [actorId, actor] of Object.entries(this.#room.actors)) {
      if (!actor) continue
      const node = this.#graph.node(actor.nodeId)
      if (!node) continue
      const pixel = roomPointToPixel(this.#room, node)
      const container = this.add.container(pixel.x, pixel.y).setDepth(90_000)
      const badge = this.add.graphics()
      if (actorId === 'spark') {
        badge.fillStyle(0x84f1e5, 1)
        badge.fillPoints([
          new Phaser.Math.Vector2(0, -18), new Phaser.Math.Vector2(5, -5), new Phaser.Math.Vector2(18, 0),
          new Phaser.Math.Vector2(5, 5), new Phaser.Math.Vector2(0, 18), new Phaser.Math.Vector2(-5, 5),
          new Phaser.Math.Vector2(-18, 0), new Phaser.Math.Vector2(-5, -5),
        ], true)
      } else {
        badge.fillStyle(0x6a625f, 1).fillRoundedRect(-17, -13, 34, 26, 7)
        badge.lineStyle(2, 0x272728, 1).strokeRoundedRect(-17, -13, 34, 26, 7)
      }
      const name = this.add.text(26, -19, actor.name, { color: '#ffffff', fontFamily: 'Segoe UI, sans-serif', fontSize: '15px', fontStyle: 'bold' })
      const label = this.add.text(26, 1, actor.label, {
        color: '#d3efea', fontFamily: 'Segoe UI, sans-serif', fontSize: '10px',
        backgroundColor: '#10242ddd', padding: { x: 3, y: 1 },
      })
      container.add([badge, name, label]).setSize(170, 48).setInteractive({ useHandCursor: true })
      container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation()
        void this.#walkToNode(actor.nodeId).then(() => this.#setState(actorId === 'spark' ? 'spark' : 'rock'))
      })
      this.#roomObjects.push(container)
    }
  }

  #createSocialActors(): void {
    for (const object of this.#socialObjects) object.destroy()
    this.#socialObjects = []
    for (const presence of this.#adapter.presence(this.#roomId)) {
      const seat = presence.seatId ? this.#room.seats.find((candidate) => candidate.id === presence.seatId) ?? null : null
      const node = this.#graph.node(presence.nodeId)
      const anchor = seat?.sit ?? node
      if (!anchor) continue
      const action: AvatarAction = seat ? 'sit' : 'idle'
      const direction = seat?.facing ?? 's'
      const appearance = appearanceForPresence(presence)
      const pixel = roomPointToPixel(this.#room, anchor)
      const depth = seat ? anchor.y * 100 + 12 : imageRoomActorDepth(anchor, 12)
      const container = this.add.container(pixel.x, pixel.y).setDepth(depth).setScale(0.88)
      const shadow = this.add.ellipse(0, 5, 34, 11, 0x020609, 0.35)
      shadow.setVisible(!seat)
      const layers: Phaser.GameObjects.Sprite[] = []
      const sheetFrame = DIRECTIONS.indexOf(direction) * ACTION_FRAMES[action]
      if (shouldUseCanonicalAvatar(appearance)) {
        layers.push(this.add.sprite(0, 0, canonicalAvatarTextureKey(action)).setOrigin(0.5, 0.88).setFrame(sheetFrame))
      } else {
        for (const layer of RENDERED_LAYERS) {
          const key = textureKey(layer, action, appearance)
          if (!key) continue
          const sprite = this.add.sprite(0, 0, key).setOrigin(0.5, 0.88).setFrame(sheetFrame)
          if (layer === 'top' && !(presence.equippedWearableIds?.length)) sprite.setTint(presence.color)
          layers.push(sprite)
        }
      }
      const name = this.add.text(0, -86, presence.displayName, {
        color: '#ffffff', fontFamily: 'Segoe UI, sans-serif', fontSize: '10px',
        backgroundColor: '#152126cc', padding: { x: 4, y: 2 },
      }).setOrigin(0.5)
      container.add([shadow, ...layers, name]).setSize(72, 100).setInteractive({ useHandCursor: true })
      container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation()
        window.dispatchEvent(new CustomEvent('radiotedu:study-player-selected', { detail: { presence } }))
      })
      this.#socialObjects.push(container)
    }
  }

  async #refreshSocialActors(): Promise<void> {
    if (this.#presenceRefreshBusy) return
    this.#presenceRefreshBusy = true
    const roomId = this.#roomId
    try {
      await this.#adapter.refreshPresence?.(roomId)
      if (roomId !== this.#roomId) return
      this.#syncSeatReservations(this.#adapter.presence(roomId))
      this.#createSocialActors()
      window.dispatchEvent(new CustomEvent('radiotedu:study-presence-updated', {
        detail: { roomId, presence: this.#adapter.presence(roomId) },
      }))
    } finally {
      this.#presenceRefreshBusy = false
    }
  }

  async #pushPresence(): Promise<void> {
    if (!this.#adapter.heartbeatPresence) return
    const point = this.#seatedSeat?.sit ?? this.#graph.node(this.#currentNodeId) ?? { x: 0, y: 0 }
    try {
      await this.#adapter.heartbeatPresence({
        roomId: this.#roomId,
        nodeId: this.#seatedSeat ? `seat:${this.#seatedSeat.id}` : this.#currentNodeId,
        seatId: this.#seatedSeat?.id ?? null,
        position: { x: point.x, y: point.y },
      })
    } catch {
      this.#showActionError('ROOM SYNC RETRY')
    }
  }

  #setSeatForeground(seat: ImageRoomSeat | null): void {
    for (const object of this.#seatForegroundObjects) object.destroy()
    this.#seatForegroundObjects = []
    if (!seat) return
    const asset = seat.foregroundAsset
    if (!asset) return
    const image = this.add.image(asset.x, asset.y, `seat-foreground:${this.#roomId}:${seat.id}`)
      .setOrigin(0)
      .setDepth(Math.max(seat.sit.y * 100 + 20, this.#seatedUpperAvatar.depth + 5))
    this.#seatForegroundObjects.push(image)
  }

  #updateAvatarFrame(frameIndex: number): void {
    const action = this.#avatarController.action
    const direction = this.#avatarController.direction
    const upperBodyCrop = avatarUpperBodyCrop(action)
    const frameCount = ACTION_FRAMES[action]
    const sheetFrame = DIRECTIONS.indexOf(direction) * frameCount + (frameIndex % frameCount)
    const orderedSlots = this.#avatarController.layers(frameIndex).map((layer) => layer.slot)
    this.#avatar.removeAll(false)
    this.#seatedUpperAvatar.removeAll(false)
    this.#seatedUpperAvatar.setPosition(this.#avatar.x, this.#avatar.y).setVisible(Boolean(upperBodyCrop))
    this.#canonicalAvatar.setVisible(false)
    this.#seatedUpperCanonical.setVisible(false)
    for (const sprite of this.#avatarSprites.values()) sprite.setVisible(false)
    for (const sprite of this.#seatedUpperSprites.values()) sprite.setVisible(false)
    if (shouldUseCanonicalAvatar(this.#avatarController.appearance)) {
      this.#canonicalAvatar.setPosition(0, 0).setTexture(canonicalAvatarTextureKey(action), sheetFrame).setVisible(true)
      this.#avatar.add(this.#canonicalAvatar)
      if (upperBodyCrop) {
        this.#seatedUpperCanonical
          .setPosition(0, 0)
          .setTexture(canonicalAvatarTextureKey(action), sheetFrame)
          .setCrop(upperBodyCrop.x, upperBodyCrop.y, upperBodyCrop.width, upperBodyCrop.height)
          .setVisible(true)
        this.#seatedUpperAvatar.add(this.#seatedUpperCanonical)
      }
      return
    }
    for (const slot of orderedSlots) {
      const sprite = this.#avatarSprites.get(slot)
      const key = textureKey(slot, action, this.#avatarController.appearance)
      if (!sprite || !key) continue
      sprite.setPosition(0, 0).setTexture(key, sheetFrame).setVisible(true)
      this.#avatar.add(sprite)
      if (upperBodyCrop) {
        const seatedUpperSprite = this.#seatedUpperSprites.get(slot)
        if (!seatedUpperSprite) continue
        seatedUpperSprite
          .setPosition(0, 0)
          .setTexture(key, sheetFrame)
          .setCrop(upperBodyCrop.x, upperBodyCrop.y, upperBodyCrop.width, upperBodyCrop.height)
          .setVisible(true)
        this.#seatedUpperAvatar.add(seatedUpperSprite)
      }
    }
  }

  #setAvatarDepth(point: Readonly<{ y: number; z: number }>): void {
    const depth = imageRoomActorDepth(point)
    this.#avatar.setDepth(depth)
    this.#seatedUpperAvatar.setDepth(depth + 1)
    this.#shadow.setDepth(depth - 2)
  }

  #setState(state: GameState): void {
    this.#state = state
    document.documentElement.dataset.gameState = state
    const output = document.querySelector<HTMLOutputElement>('#game-status')
    if (output) {
      output.value = state.toUpperCase()
      output.textContent = state.toUpperCase()
      output.dataset.state = state
    }
  }

  async #walkToNode(
    targetId: string,
    activityToken: ActivityToken = this.#activity.beginWalk(),
    beforeRoute?: () => Promise<boolean>,
  ): Promise<void> {
    const resumeState = this.#activity.snapshot().state
    this.#cancelActiveRoute(targetId)
    if (this.#seatTransitionPromise) await this.#seatTransitionPromise
    if (!this.#activity.isCurrent(activityToken)) return
    if (this.#seatedSeat || this.#standPromise) {
      this.#activity.transition(activityToken, 'standing')
      await this.stand(activityToken)
      if (!this.#activity.isCurrent(activityToken)) return
      this.#activity.transition(activityToken, resumeState)
    }
    if (beforeRoute && !(await beforeRoute())) return
    if (!this.#activity.isCurrent(activityToken)) return
    const path = smoothNavigationRoute(
      this.#graph.findPath(this.#currentNodeId, targetId).map((id) => this.#graph.node(id)!),
      this.#room.edges,
    ).map((node) => node.id)
    const routePoints = path.map((id) => {
      const node = this.#graph.node(id)!
      const pixel = roomPointToPixel(this.#room, node)
      return { id, x: pixel.x, y: pixel.y, z: node.z }
    })
    const currentZ = this.#graph.node(this.#currentNodeId)?.z ?? 0
    const firstPoint = routePoints[0]
    if (firstPoint && Math.hypot(firstPoint.x - this.#avatar.x, firstPoint.y - this.#avatar.y) > 1) {
      routePoints.unshift({ id: `route-start-${activityToken}`, x: this.#avatar.x, y: this.#avatar.y, z: currentZ })
    }
    if (routePoints.length < 2) {
      if (resumeState === 'walking') this.#activity.transition(activityToken, 'idle')
      return
    }
    const motion = buildMotionPath(routePoints)
    if (motion.totalLength === 0) return
    const durationMs = (motion.totalLength / AVATAR_WALK_SPEED) * 1_000
    const travel = { elapsedMs: 0 }
    let activeSegmentIndex = -1
    const updateMotion = () => {
      const sample = sampleMotionPathAtTime(motion, travel.elapsedMs, AVATAR_WALK_SPEED)
      if (sample.segmentIndex !== activeSegmentIndex) {
        activeSegmentIndex = sample.segmentIndex
        this.#activeSegmentFromId = this.#graph.node(sample.from.id) ? sample.from.id : this.#currentNodeId
        this.#activeSegmentToId = this.#graph.node(sample.to.id) ? sample.to.id : this.#currentNodeId
        if (this.#graph.node(sample.from.id)) this.#currentNodeId = sample.from.id
        this.#avatarController.applyMovement(sample.direction)
        this.#setState(sample.from.z !== sample.to.z ? 'stair' : 'walking')
      }
      this.#avatar.setPosition(sample.x, sample.y)
      this.#shadow.setPosition(sample.x, sample.y + 5)
      this.#updateAvatarFrame(walkFrameAtDistance(sample.distance, ACTION_FRAMES.walk, AVATAR_WALK_STRIDE))
      this.#setAvatarDepth({
        y: (sample.y / this.#room.image.height) * 100,
        z: sample.z,
      })
    }
    updateMotion()
    await new Promise<void>((resolve) => {
      let routeTween!: Phaser.Tweens.Tween
      routeTween = this.tweens.add({
        targets: travel,
        elapsedMs: durationMs,
        duration: durationMs,
        ease: 'Linear',
        onUpdate: () => {
          if (!this.#activity.isCurrent(activityToken)) {
            routeTween.stop()
            return
          }
          updateMotion()
        },
        onComplete: () => {
          if (this.#routeTween === routeTween) {
            this.#routeTween = null
            this.#activeSegmentFromId = null
            this.#activeSegmentToId = null
          }
          resolve()
        },
        onStop: () => {
          if (this.#routeTween === routeTween) this.#routeTween = null
          resolve()
        },
      })
      this.#routeTween = routeTween
    })
    if (!this.#activity.isCurrent(activityToken)) return
    this.#currentNodeId = targetId
    this.#avatarController.applyMovement({ x: 0, y: 0 })
    this.#updateAvatarFrame(0)
    this.#setState('ready')
    if (resumeState === 'walking') this.#activity.transition(activityToken, 'idle')
    void this.#pushPresence()
  }

  #cancelActiveRoute(targetId?: string): void {
    if (!this.#routeTween) return
    const candidates = [...new Set([this.#activeSegmentFromId, this.#activeSegmentToId])]
      .filter((id): id is string => Boolean(id))
      .map((id) => this.#graph.node(id))
      .filter((node): node is NavigationNode => Boolean(node))
    if (candidates.length > 0) {
      const ranked = candidates.map((node) => {
        const pixel = roomPointToPixel(this.#room, node)
        const entryDistance = Math.hypot(pixel.x - this.#avatar.x, pixel.y - this.#avatar.y)
        if (!targetId) return { node, cost: entryDistance }

        const route = smoothNavigationRoute(
          this.#graph.findPath(node.id, targetId).map((id) => this.#graph.node(id)!),
          this.#room.edges,
        )
        if (route.length === 0) return { node, cost: Number.POSITIVE_INFINITY }

        let remainingDistance = 0
        for (let index = 1; index < route.length; index += 1) {
          const from = roomPointToPixel(this.#room, route[index - 1]!)
          const to = roomPointToPixel(this.#room, route[index]!)
          remainingDistance += Math.hypot(to.x - from.x, to.y - from.y)
        }
        return { node, cost: entryDistance + remainingDistance }
      }).sort((left, right) => left.cost - right.cost)
      this.#currentNodeId = ranked[0]!.node.id
    }
    const tween = this.#routeTween
    this.#routeTween = null
    this.#activeSegmentFromId = null
    this.#activeSegmentToId = null
    tween.stop()
  }

  #createAuditoriumEventScreen(): void {
    const slides = [
      { id: 'tedu', eyebrow: 'TED UNIVERSITY', title: 'TEDU', subtitle: 'CAMPUS LIVE', color: 0xffcc4d },
      { id: 'radiotedu', eyebrow: 'ON AIR', title: 'RADIOTEDU', subtitle: 'STUDENT RADIO', color: 0xff334f },
      { id: 'tedu-live', eyebrow: 'AUDITORIUM EVENT', title: 'TEDU LIVE', subtitle: 'JOIN THE SHOW · +30 GOLD', color: 0x7ff5db },
      { id: 'campus-care', eyebrow: 'CAMPUS EVENT', title: 'CARE DAY', subtitle: 'JOIN · EARN 40 GOLD', color: 0x8fd7ff },
    ] as const

    const screen = this.add.container(785, 240).setDepth(-90_000)
    const shell = this.add.graphics()
    shell.fillStyle(0x04080f, 0.96).fillRoundedRect(-137, -104, 274, 208, 8)
    shell.lineStyle(5, 0x172a3b, 1).strokeRoundedRect(-137, -104, 274, 208, 8)
    shell.lineStyle(2, 0x57e7ff, 0.72).strokeRoundedRect(-128, -95, 256, 190, 5)
    for (let y = -88; y <= 88; y += 8) {
      shell.lineStyle(1, 0x66ddeb, 0.08).lineBetween(-123, y, 123, y)
    }

    const cornerPixels = this.add.graphics()
    cornerPixels.fillStyle(0xffcc4d, 1)
      .fillRect(-126, -93, 18, 4).fillRect(-126, -93, 4, 18)
      .fillRect(108, -93, 18, 4).fillRect(122, -93, 4, 18)
      .fillRect(-126, 89, 18, 4).fillRect(-126, 75, 4, 18)
      .fillRect(108, 89, 18, 4).fillRect(122, 75, 4, 18)

    const signal = this.add.graphics().setPosition(-93, 42)
    signal.fillStyle(0xff334f, 1).fillCircle(0, 15, 4)
    signal.lineStyle(3, 0xff334f, 1)
    for (const radius of [11, 18, 25]) {
      signal.beginPath().arc(0, 15, radius, Phaser.Math.DegToRad(285), Phaser.Math.DegToRad(355), false).strokePath()
    }

    const eyebrow = this.add.text(0, -72, '', {
      color: '#ffcc4d', fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5)
    const title = this.add.text(0, -14, '', {
      color: '#ffffff', fontFamily: 'monospace', fontSize: '28px', fontStyle: 'bold', align: 'center',
      stroke: '#0b111a', strokeThickness: 4,
    }).setOrigin(0.5)
    const subtitle = this.add.text(0, 44, '', {
      color: '#9fffea', fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5)
    const ticker = this.add.text(0, 78, '● LIVE  •  TEDU CAMPUS  •  EVENTS  •  STUDY', {
      color: '#d8f8f2', fontFamily: 'monospace', fontSize: '9px',
    }).setOrigin(0.5)
    const scanline = this.add.rectangle(0, -83, 242, 5, 0x8ffff0, 0.2)

    screen.add([shell, cornerPixels, signal, eyebrow, title, subtitle, ticker, scanline])
    this.#roomObjects.push(screen)
    this.tweens.add({ targets: scanline, y: 83, duration: 1500, repeat: -1, ease: 'Linear' })
    this.tweens.add({ targets: cornerPixels, alpha: { from: 0.45, to: 1 }, duration: 620, yoyo: true, repeat: -1 })

    let slideIndex = 0
    const showSlide = () => {
      const slide = slides[slideIndex]!
      document.documentElement.dataset.auditoriumScreen = slide.id
      eyebrow.setText(slide.eyebrow).setColor(`#${slide.color.toString(16).padStart(6, '0')}`)
      title.setText(slide.title)
      subtitle.setText(slide.subtitle)
      signal.setVisible(slide.id === 'radiotedu')
      title.setX(slide.id === 'radiotedu' ? 18 : 0)
      this.tweens.add({
        targets: [eyebrow, title, subtitle],
        alpha: { from: 0, to: 1 },
        scaleX: { from: 0.92, to: 1 },
        duration: 260,
        ease: 'Stepped',
      })
      slideIndex = (slideIndex + 1) % slides.length
    }
    showSlide()
    this.#auditoriumScreenEvent = this.time.addEvent({ delay: 3000, loop: true, callback: showSlide })
  }

  async moveByDirection(x: number, y: number): Promise<void> {
    const origin = this.#graph.node(this.#currentNodeId)
    const requestedLength = Math.hypot(x, y)
    if (!origin || requestedLength === 0) return

    const target = this.#graph.neighbors(origin.id)
      .map((candidate) => {
        const dx = candidate.x - origin.x
        const dy = candidate.y - origin.y
        const length = Math.hypot(dx, dy)
        return {
          candidate,
          score: length === 0 ? -1 : ((dx * x) + (dy * y)) / (length * requestedLength),
          distance: length,
        }
      })
      .filter(({ score }) => score > 0.18)
      .sort((left, right) => right.score - left.score || left.distance - right.distance)[0]

    if (!target) {
      this.#showActionError('BU YONDE YOL YOK')
      return
    }
    await this.#walkToNode(target.candidate.id)
  }

  async walkToSeat(seatId: string): Promise<void> {
    const seat = this.#room.seats.find((candidate) => candidate.id === seatId)
    if (!seat) throw new Error(`Unknown seat ${this.#roomId}:${seatId}`)
    const activityToken = this.#activity.beginSeatApproach(seat.id)
    const ownerId = this.#adapter.session().account.id
    const roomId = this.#roomId
    let adapterReserved = false
    let seated = false
    try {
      await this.#walkToNode(seat.approachNodeId, activityToken, async () => {
        this.#syncSeatReservations(this.#adapter.presence(roomId))
        if (!this.#seatReservations.reserve(roomId, seat.id, ownerId)) {
          throw new Error(`Seat ${roomId}:${seat.id} is occupied`)
        }
        try {
          await this.#adapter.reserveSeat(roomId, seat.id)
          adapterReserved = true
          return this.#activity.isCurrent(activityToken) && this.#roomId === roomId
        } catch (error) {
          this.#seatReservations.release(roomId, seat.id, ownerId)
          throw error
        }
      })
      if (!this.#activity.isCurrent(activityToken) || this.#currentNodeId !== seat.approachNodeId || this.#roomId !== roomId) return
      this.#activity.transition(activityToken, 'aligning-seat')
      await this.#sit(seat, activityToken)
      if (!this.#activity.isCurrent(activityToken)) return
      this.#seatReservations.occupy(roomId, seat.id, ownerId)
      seated = true
      await this.#sessionTracker?.seated(roomId, seat.id, { x: seat.sit.x, y: seat.sit.y })
      void this.#pushPresence()
    } finally {
      if (adapterReserved && !seated) {
        this.#seatReservations.release(roomId, seat.id, ownerId)
        await this.#adapter.releaseSeat()
      }
    }
  }

  async #sit(seat: ImageRoomSeat, activityToken: ActivityToken): Promise<void> {
    this.#avatarController.applyMovement(FACING_DELTA[seat.facing])
    this.#updateAvatarFrame(0)
    const sitPixel = roomPointToPixel(this.#room, seat.sit)
    const distance = Math.hypot(sitPixel.x - this.#avatar.x, sitPixel.y - this.#avatar.y)
    this.#setState('sitting')
    const transition = new Promise<void>((resolve) => this.tweens.add({
      targets: this.#avatar,
      x: sitPixel.x,
      y: sitPixel.y,
      duration: Phaser.Math.Clamp(Math.round(distance * 3.2), 220, 700),
      ease: 'Sine.easeOut',
      onComplete: () => resolve(),
    }))
    this.#seatTransitionPromise = transition
    try {
      await transition
    } finally {
      if (this.#seatTransitionPromise === transition) this.#seatTransitionPromise = null
    }
    if (!this.#activity.isCurrent(activityToken)) return
    this.#avatarController.sit()
    this.#shadow.setVisible(false)
    this.#seatedSeat = seat
    this.#activity.transition(activityToken, 'seated')
    this.#setState('seated')
    this.#setAvatarDepth(seat.sit)
    this.#seatedUpperAvatar.setDepth(Math.max(
      this.#avatar.depth + 1,
      ...this.#room.occluders.map((occluder) => occluder.depthY * 100 + 1),
    ))
    this.#setSeatForeground(seat)
    this.#updateAvatarFrame(0)
  }

  async stand(activityToken: ActivityToken = this.#activity.beginStand()): Promise<void> {
    if (this.#standPromise) return this.#standPromise
    if (!this.#seatedSeat) {
      if (this.#activity.isCurrent(activityToken) && this.#activity.snapshot().state === 'standing') {
        this.#activity.transition(activityToken, 'idle')
      }
      return
    }
    const transition = this.#performStand(activityToken)
    this.#standPromise = transition
    try {
      await transition
    } finally {
      if (this.#standPromise === transition) this.#standPromise = null
    }
  }

  async #performStand(activityToken: ActivityToken): Promise<void> {
    const seat = this.#seatedSeat
    if (!seat) return
    this.#seatedSeat = null
    const finishSession = this.#sessionTracker?.stood() ?? Promise.resolve()
    this.#seatReservations.release(this.#roomId, seat.id, this.#adapter.session().account.id)
    await this.#adapter.releaseSeat()
    this.#setSeatForeground(null)
    this.#avatarController.stand()
    this.#setState('standing')
    for (let frame = 0; frame < ACTION_FRAMES.stand; frame += 1) {
      this.#updateAvatarFrame(frame)
      await new Promise<void>((resolve) => this.time.delayedCall(130, () => resolve()))
    }
    const approach = this.#graph.node(seat.approachNodeId)!
    const pixel = roomPointToPixel(this.#room, approach)
    const distance = Math.hypot(pixel.x - this.#avatar.x, pixel.y - this.#avatar.y)
    await new Promise<void>((resolve) => this.tweens.add({
      targets: this.#avatar,
      x: pixel.x,
      y: pixel.y,
      duration: Phaser.Math.Clamp(Math.round(distance * 3.2), 180, 600),
      ease: 'Sine.easeOut',
      onComplete: () => resolve(),
    }))
    this.#shadow.setPosition(pixel.x, pixel.y + 5).setVisible(true)
    this.#setAvatarDepth(approach)
    this.#avatarController.applyMovement({ x: 0, y: 0 })
    this.#updateAvatarFrame(0)
    await finishSession
    if (this.#activity.isCurrent(activityToken)) {
      if (this.#activity.snapshot().state === 'standing') this.#activity.transition(activityToken, 'idle')
      this.#setState('ready')
      void this.#pushPresence()
    }
  }

  async switchRoom(roomId: ImageRoomId): Promise<void> {
    if (roomId === this.#roomId) return
    const previousRoomId = this.#roomId
    const ownerId = this.#adapter.session().account.id
    if (!this.#seatedSeat) this.#activity.cancel()
    this.#cancelActiveRoute()
    if (this.#seatedSeat) await this.stand()
    else if (this.#seatReservations.releaseOwner(ownerId, previousRoomId) > 0) await this.#adapter.releaseSeat()
    this.#renderRoom(roomId)
    await this.#refreshSocialActors()
  }

  equip(slot: WardrobeSlot, id: string): Promise<void> {
    const operationKey = `${slot}:${id}`
    const pending = this.#wearableOperations.get(operationKey)
    if (pending) return pending
    let operation: Promise<void>
    operation = this.#equipOnce(slot, id).finally(() => {
      if (this.#wearableOperations.get(operationKey) === operation) this.#wearableOperations.delete(operationKey)
    })
    this.#wearableOperations.set(operationKey, operation)
    return operation
  }

  async #equipOnce(slot: WardrobeSlot, id: string): Promise<void> {
    if (this.#wardrobe.inventory.state(id) === 'locked') {
      await this.#adapter.purchaseWearable(id, globalThis.crypto?.randomUUID?.() ?? `wardrobe-${Date.now()}-${id}`)
      this.#wardrobe.inventory.addOwned(id)
    }
    await this.#adapter.equipWearable(id, slot)
    const appearance = this.#wardrobe.equip(slot, id)
    this.#avatarController.equip(slot, id)
    if (appearance.hatId === null) this.#avatarSprites.get('hat')?.setVisible(false)
    this.#updateAvatarFrame(0)
    this.#syncHud()
  }

  #nodeIsReachable(nodeId: string): boolean {
    return nodeId === this.#currentNodeId || this.#graph.findPath(this.#currentNodeId, nodeId).length > 0
  }

  #syncSeatReservations(presence: readonly StudyPresence[]): void {
    const ownerId = this.#adapter.session().account.id
    this.#seatReservations.syncRemoteOccupants(this.#roomId, presence.flatMap((person) => (
      person.userId !== ownerId && person.seatId
        ? [{ seatId: person.seatId, ownerId: person.userId }]
        : []
    )))
  }

  #clearIntentMarker(): void {
    this.#intentMarker?.destroy()
    this.#intentMarker = null
  }

  #showIntentMarker(target: TouchWorldPoint, kind: 'walk' | 'seat' | 'blocked'): void {
    this.#clearIntentMarker()
    const color = kind === 'blocked' ? 0xff6b6b : kind === 'seat' ? 0xffd166 : 0x6fffe9
    const marker = kind === 'seat'
      ? this.add.ellipse(target.x, target.y, 44, 22, color, 0.12).setStrokeStyle(3, color, 0.95)
      : this.add.circle(target.x, target.y, kind === 'blocked' ? 13 : 10, color, 0.12).setStrokeStyle(3, color, 0.95)
    marker.setDepth(99_500)
    this.#intentMarker = marker
    this.tweens.add({
      targets: marker,
      alpha: 0,
      scaleX: kind === 'seat' ? 1.22 : 1.65,
      scaleY: kind === 'seat' ? 1.22 : 1.65,
      duration: kind === 'blocked' ? 420 : 620,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (this.#intentMarker === marker) this.#intentMarker = null
        marker.destroy()
      },
    })
  }

  #bindPointerMovement(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const accountId = this.#adapter.session().account.id
      const presence = this.#adapter.presence(this.#roomId)
      this.#syncSeatReservations(presence)
      const intent = resolveTouchIntent({
        world: { x: pointer.worldX, y: pointer.worldY },
        uiConsumed: pointer.event.target instanceof Element
          && Boolean(pointer.event.target.closest('[data-study-ui]')),
        seated: Boolean(this.#seatedSeat),
        activeSeatIntentId: this.#activity.snapshot().activeSeatId,
        nodes: this.#room.nodes.map((node) => ({
          id: node.id,
          ...roomPointToPixel(this.#room, node),
          reachable: this.#nodeIsReachable(node.id),
        })),
        seats: this.#room.seats.map((seat) => ({
          id: seat.id,
          ...roomPointToPixel(this.#room, seat.sit),
          reachable: this.#nodeIsReachable(seat.approachNodeId),
          occupied: !this.#seatReservations.isAvailable(this.#roomId, seat.id, accountId),
        })),
        players: presence.flatMap((person) => {
          if (person.userId === accountId) return []
          const seat = person.seatId ? this.#room.seats.find((candidate) => candidate.id === person.seatId) : null
          const anchor = seat?.sit ?? this.#graph.node(person.nodeId)
          return anchor ? [{ userId: person.userId, ...roomPointToPixel(this.#room, anchor) }] : []
        }),
      })

      if (intent.kind === 'ignored') return
      if (intent.kind === 'stand') {
        this.#clearIntentMarker()
        void this.stand()
        return
      }
      if (intent.kind === 'interact-player') {
        const selected = presence.find((person) => person.userId === intent.userId)
        if (selected) window.dispatchEvent(new CustomEvent('radiotedu:study-player-selected', { detail: { presence: selected } }))
        return
      }
      this.#showIntentMarker(intent.target, intent.kind === 'sit' ? 'seat' : intent.kind)
      if (intent.kind === 'blocked') {
        this.#showActionError(intent.reason === 'occupied-seat' ? 'KOLTUK DOLU' : 'YOL KAPALI')
        return
      }
      if (intent.kind === 'sit') {
        void this.walkToSeat(intent.seatId).catch(() => this.#showActionError('KOLTUK KULLANILAMIYOR'))
        return
      }
      void this.#walkToNode(intent.nodeId)
    })
  }

  #bindKeyboardMovement(): void {
    window.addEventListener('keydown', this.#keyboardHandler)
  }

  #bindHud(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-room-id]').forEach((button) => {
      button.addEventListener('click', () => { void this.switchRoom(button.dataset.roomId as ImageRoomId) })
    })
    document.querySelectorAll<HTMLButtonElement>('[data-wearable-id]').forEach((button) => {
      button.addEventListener('click', () => {
        void this.equip(button.dataset.slot as WardrobeSlot, button.dataset.wearableId!)
          .catch(() => this.#showActionError('ITEM UNAVAILABLE'))
      })
    })
  }

  #showActionError(message: string): void {
    const output = document.querySelector<HTMLOutputElement>('#game-status')
    if (!output) return
    output.value = message
    output.textContent = message
    const activityToken = this.#activity.snapshot().token
    this.time.delayedCall(1_800, () => {
      if (this.#activity.isCurrent(activityToken)) this.#setState(this.#state)
    })
  }

  #syncHud(): void {
    document.documentElement.dataset.roomId = this.#roomId
    const appearance = this.#avatarController.appearance
    const pointBalance = document.querySelector<HTMLElement>('#point-balance')
    if (pointBalance) pointBalance.textContent = String(this.#adapter.session().points.global)
    document.documentElement.dataset.topId = appearance.topId
    document.documentElement.dataset.bottomId = appearance.bottomId
    document.documentElement.dataset.shoesId = appearance.shoesId
    document.documentElement.dataset.hatId = appearance.hatId ?? 'none'
    document.querySelectorAll<HTMLButtonElement>('[data-room-id]').forEach((button) => {
      const selected = button.dataset.roomId === this.#roomId
      button.setAttribute('aria-selected', String(selected))
      button.classList.toggle('is-selected', selected)
    })
    document.querySelectorAll<HTMLButtonElement>('[data-wearable-id]').forEach((button) => {
      const slot = button.dataset.slot as WardrobeSlot
      const equipped = this.#wardrobe.inventory.equippedId(slot) === button.dataset.wearableId
      button.setAttribute('aria-pressed', String(equipped))
      button.dataset.state = equipped ? 'equipped' : this.#wardrobe.inventory.state(button.dataset.wearableId!)
    })
    const southFrameY = -(DIRECTIONS.indexOf('s') * 96)
    document.querySelectorAll<HTMLElement>('[data-avatar-preview-layer]').forEach((layer) => {
      const slot = layer.dataset.avatarPreviewLayer as AvatarLayerSlot
      const file = textureFile(slot, 'idle', appearance)
      layer.hidden = !file
      layer.style.backgroundImage = file ? `url("${ASSET_BASE}/${file}")` : ''
      layer.style.backgroundPosition = `0 ${southFrameY}px`
    })
    const lookName = document.querySelector<HTMLElement>('#wardrobe-look-name')
    if (lookName) {
      const readable = (id: string) => id.split('-').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ')
      lookName.textContent = [appearance.topId, appearance.hatId].filter(Boolean).map((id) => readable(id!)).join(' + ')
    }
    const title = document.querySelector<HTMLElement>('#room-title')
    if (title) title.textContent = this.#room.title
  }

  #exposeDebugApi(): void {
    window.__STUDY_GAME_APP__ = {
      switchRoom: (roomId) => this.switchRoom(roomId),
      walkToNode: (nodeId) => this.#walkToNode(nodeId),
      moveByDirection: (x, y) => this.moveByDirection(x, y),
      walkToSeat: (seatId) => this.walkToSeat(seatId),
      stand: () => this.stand(),
      equip: (slot, id) => this.equip(slot, id),
      tapTargets: () => {
        const camera = this.cameras.main
        const canvasBounds = this.game.canvas.getBoundingClientRect()
        const displayScaleX = canvasBounds.width / this.game.canvas.width
        const displayScaleY = canvasBounds.height / this.game.canvas.height
        const accountId = this.#adapter.session().account.id
        const screen = (world: { x: number; y: number }) => ({
          x: canvasBounds.left + (camera.x + (world.x - camera.worldView.x) * camera.zoom) * displayScaleX,
          y: canvasBounds.top + (camera.y + (world.y - camera.worldView.y) * camera.zoom) * displayScaleY,
        })
        return {
          nodes: this.#room.nodes.map((node) => {
            const world = roomPointToPixel(this.#room, node)
            return { id: node.id, reachable: this.#nodeIsReachable(node.id), world, screen: screen(world) }
          }),
          seats: this.#room.seats.map((seat) => {
            const world = roomPointToPixel(this.#room, seat.sit)
            return {
              id: seat.id,
              reachable: this.#nodeIsReachable(seat.approachNodeId),
              occupied: !this.#seatReservations.isAvailable(this.#roomId, seat.id, accountId),
              world,
              screen: screen(world),
            }
          }),
        }
      },
      snapshot: () => ({
        roomId: this.#roomId,
        state: this.#state,
        nodeId: this.#currentNodeId,
        activeSegment: this.#activeSegmentFromId && this.#activeSegmentToId
          ? { fromId: this.#activeSegmentFromId, toId: this.#activeSegmentToId }
          : null,
        seatId: this.#seatedSeat?.id ?? null,
        position: { x: this.#avatar.x, y: this.#avatar.y },
        z: this.#seatedSeat?.sit.z ?? this.#graph.node(this.#currentNodeId)?.z ?? 0,
        hatId: this.#avatarController.appearance.hatId,
        topId: this.#avatarController.appearance.topId,
        bottomId: this.#avatarController.appearance.bottomId,
        shoesId: this.#avatarController.appearance.shoesId,
        layerTextures: Object.fromEntries(
          [...this.#avatarSprites].map(([slot, sprite]) => [slot, sprite.visible ? sprite.texture.key : null]),
        ) as Partial<Record<AvatarLayerSlot, string | null>>,
        sparkLabel: this.#room.actors.spark?.label ?? null,
        camera: {
          zoom: this.cameras.main.zoom,
          x: this.cameras.main.x,
          y: this.cameras.main.y,
          worldViewX: this.cameras.main.worldView.x,
          worldViewY: this.cameras.main.worldView.y,
          worldViewWidth: this.cameras.main.worldView.width,
          worldViewHeight: this.cameras.main.worldView.height,
        },
        roomSize: { width: this.#room.image.width, height: this.#room.image.height },
      }),
    }
  }
}

declare global {
  interface Window {
    __STUDY_GAME_APP__: {
      switchRoom(roomId: ImageRoomId): Promise<void>
      walkToNode(nodeId: string): Promise<void>
      moveByDirection(x: number, y: number): Promise<void>
      walkToSeat(seatId: string): Promise<void>
      stand(): Promise<void>
      equip(slot: WardrobeSlot, id: string): Promise<void>
      tapTargets(): {
        nodes: Array<{
          id: string
          reachable: boolean
          world: { x: number; y: number }
          screen: { x: number; y: number }
        }>
        seats: Array<{
          id: string
          reachable: boolean
          occupied: boolean
          world: { x: number; y: number }
          screen: { x: number; y: number }
        }>
      }
      snapshot(): {
        roomId: ImageRoomId
        state: GameState
        nodeId: string
        activeSegment: { fromId: string; toId: string } | null
        seatId: string | null
        position: { x: number; y: number }
        z: number
        hatId: string | null
        topId: string
        bottomId: string
        shoesId: string
        layerTextures: Partial<Record<AvatarLayerSlot, string | null>>
        sparkLabel: string | null
        camera: {
          zoom: number
          x: number
          y: number
          worldViewX: number
          worldViewY: number
          worldViewWidth: number
          worldViewHeight: number
        }
        roomSize: { width: number; height: number }
      }
    }
  }
}
