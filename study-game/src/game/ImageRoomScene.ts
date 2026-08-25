import Phaser from 'phaser'

import { LocalStudyAdapter } from '../adapters/LocalStudyAdapter'
import type { StudyAdapter, StudyChatMessage, StudyPresence } from '../adapters/StudyAdapter'
import { DIRECTIONS, type AvatarAction, type AvatarAppearance, type AvatarLayerSlot, type Direction8 } from '../avatar/AvatarAppearance'
import { DEFAULT_AVATAR_ASSET_MANIFEST } from '../avatar/AvatarAssetManifest'
import { resolveInitialAvatarAppearance } from '../avatar/InitialAvatarAppearance'
import { canonicalAvatarTextureKey, shouldUseCanonicalAvatar } from '../avatar/AvatarPresentation'
import { InventoryStore } from '../inventory/InventoryStore'
import { studyGear } from '../inventory/StudyGearStore'
import { WearableCatalog, type WardrobeItem, type WardrobeSlot } from '../inventory/WearableCatalog'
import { WardrobeController } from '../inventory/WardrobeController'
import { NavigationGraph } from '../pathfinding/NavigationGraph'
import { pointInPolygon, RoomNavigationField, type WorldPoint } from '../pathfinding/RoomNavigationField'
import { STUDY_RADIO_CHANNELS, type StudyRadioChannelId } from '../radio/StudyRadioChannels'
import { IMAGE_ROOMS, roomPointToPixel, type ImageRoomDefinition, type ImageRoomId, type ImageRoomSeat } from '../rooms/ImageRoomDefinition'
import { AUDITORIUM_EVENT_SCREEN_BOUNDS } from '../rooms/AuditoriumPresentation'
import { libraryDeviceSocket } from '../rooms/LibrarySeatCalibration'
import { roomCatPatrolPoints } from '../rooms/RoomCatPatrols'
import { roomAvatarScale } from '../rooms/RoomAvatarPresentation'
import { roomInteractionObstacles, roomNavigationGeometry } from '../rooms/RoomNavigationProfiles'
import { resolveSeatGeometry } from '../rooms/RoomSeatGeometry'
import type { StudySessionTracker } from '../session/StudySessionTracker'
import { StudyPresenceLoop } from '../session/StudyPresenceLoop'
import { AvatarController } from './AvatarController'
import { AvatarActivityMachine, type ActivityToken } from './AvatarActivityMachine'
import { calculateOverviewZoom, calculatePlayableZoom, cameraFramingMode } from './CameraFraming'
import { imageRoomActorDepth } from './ImageRoomDepth'
import { buildMotionPath, sampleMotionPathAtTime, walkFrameAtDistance } from './PathMotion'
import { ROOM_AMBIENCE } from './RoomAmbience'
import { SeatReservationBook } from './SeatReservationBook'
import { resolveSeatHitTarget, resolveTouchIntent, type TouchWorldPoint } from './TouchIntentResolver'

const ACTION_FRAMES: Record<AvatarAction, number> = { idle: 4, walk: 4, sit: 4, stand: 3 }
const RENDERED_LAYERS: AvatarLayerSlot[] = ['body', 'skin', 'hair', 'top', 'bottom', 'shoes', 'hat']
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/avatars/engine-proof`
const CAMPUS_CAT_ASSETS = ['campus-cat-tarcin-walk.png', 'campus-cat-benek-walk.png', 'campus-cat-komur-walk.png'] as const
const ROOM_BASE = import.meta.env.BASE_URL
const SUPPORTED_ITEMS = ['short-hair', 'radio-hoodie', 'radiotedu-tee', 'varsity-jacket', 'jeans', 'black-cargos', 'sneakers', 'boots', 'bucket-hat', 'beanie'] as const
const AVATAR_WALK_SPEED = 280
const AVATAR_WALK_STRIDE = 18
const CAMPUS_CAT_PAW_BASELINE = 184 / 192
const CAMPUS_CAT_SCALE = 0.21
const CAMPUS_CAT_SHADOW = Object.freeze({ width: 28, height: 8 })
const CAMPUS_CAT_NAMES = ['Tarçın', 'Benek', 'Kömür'] as const
const MOUSE_SEAT_HIT_SLOP_PX = 10
const TOUCH_SEAT_HIT_SLOP_PX = 18
const CAMPUS_CAT_ROSTERS: Readonly<Record<ImageRoomId, readonly (typeof CAMPUS_CAT_NAMES)[number][]>> = Object.freeze({
  library: [CAMPUS_CAT_NAMES[0]],
  'chim-alan': [CAMPUS_CAT_NAMES[1], CAMPUS_CAT_NAMES[2]],
  'sports-center': [CAMPUS_CAT_NAMES[1]],
  auditorium: [CAMPUS_CAT_NAMES[0]],
  'learning-lab': [CAMPUS_CAT_NAMES[2]],
})

type CampusCat = {
  name: (typeof CAMPUS_CAT_NAMES)[number]
  nodeId: string
  roomId: ImageRoomId
  sprite: Phaser.GameObjects.Sprite
  shadow: Phaser.GameObjects.Ellipse
  z: number
  walking: boolean
  frame: number
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

type RoomStructuralForeground = Readonly<{
  id: string
  depthY: number
  polygons: readonly (readonly Readonly<{ x: number; y: number }>[])[]
}>

const ROOM_STRUCTURAL_FOREGROUNDS: Readonly<Partial<Record<ImageRoomId, readonly RoomStructuralForeground[]>>> = Object.freeze({
  'chim-alan': Object.freeze([
    Object.freeze({
      id: 'restaurant-front-facade',
      depthY: 44.5,
      polygons: Object.freeze([
        Object.freeze([{ x: 1010, y: 157 }, { x: 1488, y: 276 }, { x: 1488, y: 431 }, { x: 1010, y: 311 }]),
        Object.freeze([{ x: 1488, y: 276 }, { x: 1570, y: 231 }, { x: 1570, y: 388 }, { x: 1488, y: 431 }]),
      ]),
    }),
  ]),
})

function directionForVector(vector: Readonly<{ x: number; y: number }>): Direction8 {
  if (Math.abs(vector.x) < 0.001 && Math.abs(vector.y) < 0.001) return 's'
  const eighth = Math.round(Math.atan2(vector.y, vector.x) / (Math.PI / 4))
  return ({
    '-4': 'w', '-3': 'nw', '-2': 'n', '-1': 'ne',
    '0': 'e', '1': 'se', '2': 's', '3': 'sw', '4': 'w',
  } as const)[String(eighth) as '-4' | '-3' | '-2' | '-1' | '0' | '1' | '2' | '3' | '4']
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
    if (['radio-hoodie', 'radiotedu-tee', 'varsity-jacket'].includes(id)) appearance.topId = id
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
  #navigationField = new RoomNavigationField({
    width: this.#room.image.width,
    height: this.#room.image.height,
    geometry: roomNavigationGeometry(this.#room),
    clearance: 18,
  })
  #catNavigationField = new RoomNavigationField({
    width: this.#room.image.width,
    height: this.#room.image.height,
    geometry: roomNavigationGeometry(this.#room),
    clearance: 12,
  })
  #currentNodeId = this.#room.spawnNodeId
  #currentZ = this.#graph.node(this.#currentNodeId)?.z ?? 0
  #state: GameState = 'ready'
  #activity = new AvatarActivityMachine()
  #seatReservations = new SeatReservationBook()
  #routeTween: Phaser.Tweens.Tween | null = null
  #activeSegmentFromId: string | null = null
  #activeSegmentToId: string | null = null
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
  #seatActorMaskSource: Phaser.GameObjects.Graphics | null = null
  #studyDevice: Phaser.GameObjects.Image | null = null
  #studyDeviceGlow: Phaser.GameObjects.Ellipse | null = null
  #avatarAnimationEvent: Phaser.Time.TimerEvent | null = null
  #avatarAnimationFrame = 0
  #socialObjects: Phaser.GameObjects.GameObject[] = []
  #campusCats: CampusCat[] = []
  #chatBubbles = new Map<string, Phaser.GameObjects.Container>()
  #auditoriumScreenEvent: Phaser.Time.TimerEvent | null = null
  #intentMarker: Phaser.GameObjects.GameObject | null = null
  #pendingPointerIntent: Readonly<{ world: TouchWorldPoint; uiConsumed: boolean; seatHitSlop: number }> | null = null
  #pointerIntentFrame: number | null = null
  #lastWalkTarget: WorldPoint | null = null
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
  #gearChangedHandler = (): void => {
    this.#syncStudyDevice()
    const selected = studyGear.snapshot().equipped.pet
    const selectedIndex = selected === 'pet-benek' ? 1 : selected === 'pet-komur' ? 2 : 0
    const cat = this.#campusCats[0]
    if (cat && selected) {
      cat.name = CAMPUS_CAT_NAMES[selectedIndex]!
      cat.sprite.setTexture(`campus-cat:${selectedIndex}`)
      cat.sprite.setData('campusCatName', cat.name)
    }
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
      this.load.spritesheet(`campus-cat:${index}`, `${import.meta.env.BASE_URL}assets/npcs/${asset}`, {
        frameWidth: 256,
        frameHeight: 192,
        endFrame: 31,
      })
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
    for (const laptop of ['laptop-campus', 'laptop-pro', 'laptop-gold'] as const) {
      this.load.image(`study-device:${laptop}:far`, `${import.meta.env.BASE_URL}assets/study-gear/items/${laptop}-table-back-v3.png`)
      this.load.image(`study-device:${laptop}:near`, `${import.meta.env.BASE_URL}assets/study-gear/items/${laptop}-table-front-v3.png`)
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
        top: ['radio-hoodie', 'radiotedu-tee', 'varsity-jacket'],
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
    this.#startAvatarAnimationLoop()
    this.#renderRoom(this.#initialRoom)
    this.#bindPointerMovement()
    this.#bindKeyboardMovement()
    this.#bindHud()
    if (import.meta.env.DEV) this.#exposeDebugApi()
    this.#presenceLoop = new StudyPresenceLoop(
      () => this.#pushPresence(),
      () => this.#refreshSocialActors(),
    )
    this.#presenceLoop.start()
    window.addEventListener('radiotedu:study-chat-message', this.#chatMessageHandler)
    window.addEventListener('radiotedu:study-ignore-changed', this.#ignoreChangedHandler)
    window.addEventListener('radiotedu:study-gear-changed', this.#gearChangedHandler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.#pointerIntentFrame !== null) window.cancelAnimationFrame(this.#pointerIntentFrame)
      this.#pointerIntentFrame = null
      this.#pendingPointerIntent = null
      this.#clearIntentMarker()
      this.#presenceLoop?.stop()
      this.#presenceLoop = null
      this.#avatarAnimationEvent?.remove(false)
      this.#avatarAnimationEvent = null
      const ownerId = this.#adapter.session().account.id
      if (this.#seatReservations.releaseOwner(ownerId) > 0) void this.#adapter.releaseSeat()
      void this.#sessionTracker?.stood().catch(() => undefined)
      window.removeEventListener('keydown', this.#keyboardHandler)
      window.removeEventListener('radiotedu:study-chat-message', this.#chatMessageHandler)
      window.removeEventListener('radiotedu:study-ignore-changed', this.#ignoreChangedHandler)
      window.removeEventListener('radiotedu:study-gear-changed', this.#gearChangedHandler)
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

  #startAvatarAnimationLoop(): void {
    this.#avatarAnimationEvent?.remove(false)
    this.#avatarAnimationFrame = 0
    this.#avatarAnimationEvent = this.time.addEvent({
      delay: 280,
      loop: true,
      callback: () => {
        this.#avatarAnimationFrame += 1
        if (this.#state === 'ready' && this.#avatarController.action === 'idle') {
          this.#updateAvatarFrame(this.#avatarAnimationFrame)
        } else if (this.#state === 'seated' && this.#avatarController.action === 'sit') {
          this.#updateAvatarFrame(this.#avatarAnimationFrame)
        }

        for (const object of this.#socialObjects) {
          if (!(object instanceof Phaser.GameObjects.Container)) continue
          const action = object.getData('avatarAction') as AvatarAction | undefined
          const directionIndex = object.getData('avatarDirectionIndex') as number | undefined
          if ((action !== 'idle' && action !== 'sit') || typeof directionIndex !== 'number') continue
          const frameCount = ACTION_FRAMES[action]
          const sheetFrame = directionIndex * frameCount + (this.#avatarAnimationFrame % frameCount)
          for (const child of object.list) {
            if (child instanceof Phaser.GameObjects.Sprite) child.setFrame(sheetFrame)
          }
        }
      },
    })
    document.documentElement.dataset.avatarAnimation = 'idle-sit-four-frame'
  }

  #clearRoomObjects(): void {
    this.#auditoriumScreenEvent?.remove(false)
    this.#auditoriumScreenEvent = null
    delete document.documentElement.dataset.auditoriumScreen
    this.tweens.killTweensOf(this.#roomObjects)
    for (const object of [...this.#roomObjects, ...this.#seatForegroundObjects, ...this.#socialObjects]) object.destroy()
    this.#roomObjects = []
    this.#seatForegroundObjects = []
    this.#socialObjects = []
    this.#campusCats = []
    if (this.#studyDeviceGlow) this.tweens.killTweensOf(this.#studyDeviceGlow)
    this.#studyDevice?.destroy()
    this.#studyDevice = null
    this.#studyDeviceGlow?.destroy()
    this.#studyDeviceGlow = null
    this.#chatBubbles.clear()
    delete document.documentElement.dataset.campusCats
    delete document.documentElement.dataset.lastCampusCat
    delete document.documentElement.dataset.chatBubble
    delete document.documentElement.dataset.chatSpeaker
    delete document.documentElement.dataset.roomAmbience
    delete document.documentElement.dataset.ambientObjects
    delete document.documentElement.dataset.ambientMotion
    delete document.documentElement.dataset.structuralForegrounds
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
      const worldAnchor = seat
        ? resolveSeatGeometry(this.#room, seat).actorAnchor
        : presence.position ?? node
      if (!worldAnchor) return
      anchor = roomPointToPixel(this.#room, worldAnchor)
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
    const geometry = roomNavigationGeometry(this.#room)
    this.#navigationField = new RoomNavigationField({
      width: this.#room.image.width,
      height: this.#room.image.height,
      geometry,
      clearance: 18,
    })
    const catSeatObstacles = this.#room.seats.map((seat) => (
      resolveSeatGeometry(this.#room, seat).hitArea.map((point) => roomPointToPixel(this.#room, point))
    ))
    this.#catNavigationField = new RoomNavigationField({
      width: this.#room.image.width,
      height: this.#room.image.height,
      geometry: Object.freeze({ ...geometry, obstacles: Object.freeze([...geometry.obstacles, ...catSeatObstacles]) }),
      clearance: 12,
    })
    this.#currentNodeId = this.#room.spawnNodeId
    this.#currentZ = this.#graph.node(this.#currentNodeId)?.z ?? 0
    this.#seatedSeat = null
    delete document.documentElement.dataset.seatedSeatId

    this.#background = this.add.image(0, 0, `room:${roomId}`).setOrigin(0).setDepth(-100_000)
    this.#roomObjects.push(this.#background)
    this.#createRoomAmbience()
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
    if (window.__STUDY_GAME_APP__) {
      document.documentElement.dataset.seatTapTargets = JSON.stringify(
        window.__STUDY_GAME_APP__.tapTargets().seats,
      )
    }
    window.dispatchEvent(new CustomEvent('radiotedu:study-room-changed', { detail: { roomId: this.#roomId } }))
    void this.#pushPresence()
  }

  #fitCamera(): void {
    const viewport = this.scale.gameSize
    const framing = cameraFramingMode(viewport, this.#room.image)
    const zoom = framing === 'overview'
      ? calculateOverviewZoom(viewport, this.#room.image)
      : calculatePlayableZoom(viewport, this.#room.image)
    const camera = this.cameras.main
    camera.stopFollow()
    camera.removeBounds()
    if (framing === 'follow') {
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
      // The generated Library table layers are diagonal room-image strips,
      // not transparent furniture cutouts. Their opaque carpet pixels erase
      // actors (head above the strip, shoes below it). Furniture collision now
      // keeps walkers out of the tables, and #setSeatForeground supplies the
      // precise narrow occlusion needed by far-side seated avatars.
      if (this.#roomId === 'library' && occluder.id.endsWith('study-table')) continue
      const image = this.add.image(occluder.asset.x, occluder.asset.y, `occluder:${this.#roomId}:${occluder.id}`).setOrigin(0)
      image.setDepth(occluder.depthY * 100)
      this.#roomObjects.push(image)
    }

    const structuralForegrounds = ROOM_STRUCTURAL_FOREGROUNDS[this.#roomId] ?? []
    for (const foreground of structuralForegrounds) {
      const maskSource = this.make.graphics({ x: 0, y: 0 })
      maskSource.fillStyle(0xffffff, 1)
      for (const polygon of foreground.polygons) {
        maskSource.fillPoints(polygon.map((point) => new Phaser.Math.Vector2(point.x, point.y)), true)
      }
      const image = this.add.image(0, 0, `room:${this.#roomId}`).setOrigin(0)
      image.setMask(maskSource.createGeometryMask())
      image.setDepth(foreground.depthY * 100)
      image.setData('structuralForeground', foreground.id)
      this.#roomObjects.push(image, maskSource)
    }
    document.documentElement.dataset.structuralForegrounds = String(structuralForegrounds.length)
  }

  #createRoomAmbience(): void {
    const plan = ROOM_AMBIENCE[this.#roomId]
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    let objectCount = 0

    for (const item of plan.glows) {
      const glow = this.add.ellipse(
        (item.x / 100) * this.#room.image.width,
        (item.y / 100) * this.#room.image.height,
        (item.width / 100) * this.#room.image.width,
        (item.height / 100) * this.#room.image.height,
        item.color,
        item.alpha,
      ).setDepth(-97_000).setBlendMode(Phaser.BlendModes.ADD)
      glow.setData('ambientEffect', 'glow')
      this.#roomObjects.push(glow)
      objectCount += 1
      if (!reducedMotion) {
        this.tweens.add({
          targets: glow,
          alpha: { from: item.alpha * 0.58, to: item.alpha },
          scaleX: { from: 0.94, to: 1.04 },
          scaleY: { from: 0.94, to: 1.04 },
          duration: item.durationMs,
          delay: item.delayMs ?? 0,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        })
      }
    }

    for (const drift of plan.drifts) {
      for (let index = 0; index < drift.count; index += 1) {
        const horizontal = ((index * 37 + 17) % 101) / 100
        const vertical = ((index * 53 + 29) % 101) / 100
        const x = ((drift.x + drift.width * horizontal) / 100) * this.#room.image.width
        const y = ((drift.y + drift.height * vertical) / 100) * this.#room.image.height
        const size = drift.kind === 'sheen' ? drift.size * 2.4 : drift.size
        const ambient = drift.kind === 'dust'
          ? this.add.circle(x, y, Math.max(1, size / 2), drift.color, drift.alpha)
          : this.add.rectangle(x, y, size, drift.kind === 'leaf' ? Math.max(2, size * 0.42) : 2, drift.color, drift.alpha)
        ambient.setDepth(-96_000 + index).setBlendMode(drift.kind === 'leaf' ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD)
        ambient.setAngle(drift.kind === 'leaf' ? index * 31 - 40 : -18)
        ambient.setData('ambientEffect', drift.kind)
        this.#roomObjects.push(ambient)
        objectCount += 1
        if (!reducedMotion) {
          this.tweens.add({
            targets: ambient,
            x: x + (drift.travelX / 100) * this.#room.image.width,
            y: y + (drift.travelY / 100) * this.#room.image.height,
            alpha: { from: drift.alpha * 0.25, to: drift.alpha },
            angle: ambient.angle + (drift.kind === 'leaf' ? 95 : 8),
            duration: drift.durationMs + index * 290,
            delay: index * 410,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
          })
        }
      }
    }

    document.documentElement.dataset.roomAmbience = plan.label
    document.documentElement.dataset.ambientObjects = String(objectCount)
    document.documentElement.dataset.ambientMotion = reducedMotion ? 'reduced' : 'animated'
  }

  #createCampusCats(): void {
    const available = roomCatPatrolPoints(this.#room).filter((point) => (
      this.#catNavigationField.isWalkable(point, point.z)
    ))
    const equippedPet = studyGear.snapshot().equipped.pet
    const equippedName = equippedPet === 'pet-benek' ? CAMPUS_CAT_NAMES[1]
      : equippedPet === 'pet-komur' ? CAMPUS_CAT_NAMES[2]
      : CAMPUS_CAT_NAMES[0]
    const roster = this.#roomId === 'library' && equippedPet ? [equippedName] : CAMPUS_CAT_ROSTERS[this.#roomId]
    const count = Math.min(roster.length, available.length)
    const remaining = [...available]

    for (let index = 0; index < count; index += 1) {
      const candidateIndex = Phaser.Math.Between(0, Math.max(0, remaining.length - 1))
      const [node] = remaining.splice(candidateIndex, 1)
      if (!node) break
      const pixel = node
      const name = roster[index]!
      const depth = ((node.y / this.#room.image.height) * 100) * 100
      const shadow = this.add.ellipse(
        pixel.x,
        pixel.y + 2,
        CAMPUS_CAT_SHADOW.width,
        CAMPUS_CAT_SHADOW.height,
        0x020609,
        0.34,
      )
        .setDepth(depth + 42)
      const sprite = this.add.sprite(pixel.x, pixel.y, `campus-cat:${CAMPUS_CAT_NAMES.indexOf(name)}`)
        .setOrigin(0.5, CAMPUS_CAT_PAW_BASELINE)
        .setScale(CAMPUS_CAT_SCALE)
        .setDepth(depth + 45)
        .setInteractive({ useHandCursor: true })
      const cat: CampusCat = { name, nodeId: node.id, roomId: this.#roomId, sprite, shadow, z: node.z, walking: false, frame: 0 }
      sprite.setData('campusCatName', name)
      sprite.on('pointerdown', (
        pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        const target = pointer.event.target
        if (target instanceof Element && target.closest('[data-study-ui]')) return
        event.stopPropagation()
        this.#showCampusCatGreeting(cat)
      })
      this.#campusCats.push(cat)
      this.#roomObjects.push(shadow, sprite)
      this.#scheduleCampusCatWander(cat, Phaser.Math.Between(450, 900))
    }

    document.documentElement.dataset.campusCats = String(this.#campusCats.length)
  }

  #scheduleCampusCatWander(cat: CampusCat, delay = Phaser.Math.Between(3_800, 7_500)): void {
    this.time.delayedCall(delay, () => {
      if (!cat.sprite.active || cat.roomId !== this.#roomId) return
      const occupiedSeats = new Set(this.#adapter.presence(this.#roomId).flatMap((presence) => (
        presence.seatId ? [presence.seatId] : []
      )))
      const occupiedSeatAnchors = this.#room.seats
        .filter((seat) => occupiedSeats.has(seat.id))
        .map((seat) => roomPointToPixel(this.#room, resolveSeatGeometry(this.#room, seat).actorAnchor))
      const candidates = roomCatPatrolPoints(this.#room).flatMap((point) => {
        if (point.z !== cat.z || point.id === cat.nodeId) return []
        if (occupiedSeatAnchors.some((anchor) => Math.hypot(anchor.x - point.x, anchor.y - point.y) < 90)) return []
        if (!this.#catNavigationField.isWalkable(point, point.z)) return []
        const route = this.#catNavigationField.findPath({ x: cat.sprite.x, y: cat.sprite.y }, point, cat.z)
        return route.length >= 2 ? [{ node: point, route }] : []
      })
      if (candidates.length === 0) {
        this.#scheduleCampusCatWander(cat)
        return
      }
      const { node: target, route } = Phaser.Utils.Array.GetRandom(candidates)
      const motion = buildMotionPath(route.map((point, routeIndex) => ({
        id: `cat:${cat.name}:${routeIndex}`,
        x: point.x,
        y: point.y,
        z: cat.z,
      })))
      const speed = 82
      const duration = (motion.totalLength / speed) * 1_000
      const travel = { elapsedMs: 0 }
      cat.walking = true
      this.tweens.add({
        targets: travel,
        elapsedMs: duration,
        duration,
        ease: 'Linear',
        onUpdate: () => {
          const sample = sampleMotionPathAtTime(motion, travel.elapsedMs, speed)
          const direction = directionForVector(sample.direction)
          cat.frame = DIRECTIONS.indexOf(direction) * 4 + walkFrameAtDistance(sample.distance, 4, 22)
          cat.sprite.setFrame(cat.frame).setPosition(sample.x, sample.y)
          cat.shadow.setPosition(sample.x, sample.y + 2)
          const depth = ((sample.y / this.#room.image.height) * 100) * 100
          cat.shadow.setDepth(depth + 42)
          cat.sprite.setDepth(depth + 45)
        },
        onComplete: () => {
          cat.nodeId = target.id
          cat.walking = false
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
    const bubble = this.add.container(cat.sprite.x, cat.sprite.y - 50, [copy]).setDepth(900_000_000)
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
      const radioChannelId: StudyRadioChannelId | null = actorId === 'spark' || actorId === 'rock' ? actorId : null
      const radioChannel = radioChannelId ? STUDY_RADIO_CHANNELS[radioChannelId] : null
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
      const label = this.add.text(26, 1, radioChannel ? `${radioChannel.title} · Play` : actor.label, {
        color: '#d3efea', fontFamily: 'Segoe UI, sans-serif', fontSize: '10px',
        backgroundColor: '#10242ddd', padding: { x: 3, y: 1 },
      })
      // Keep roadside stations touchable while the follow camera is still
      // easing after a previous station tap. The actors are far apart, so this
      // larger mobile-safe target cannot overlap another world interaction.
      container.add([badge, name, label]).setSize(210, 120).setInteractive({ useHandCursor: true })
      container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        const target = pointer.event.target
        if (target instanceof Element && target.closest('[data-study-ui]')) return
        pointer.event.stopPropagation()
        if (radioChannelId) {
          window.dispatchEvent(new CustomEvent('radiotedu:study-radio-select', {
            detail: { channelId: radioChannelId },
          }))
        }
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
      const anchor = seat
        ? resolveSeatGeometry(this.#room, seat).actorAnchor
        : presence.position ?? node
      if (!anchor) continue
      const action: AvatarAction = seat ? 'sit' : 'idle'
      const direction = seat?.facing ?? 's'
      const appearance = appearanceForPresence(presence)
      const pixel = roomPointToPixel(this.#room, anchor)
      const depth = seat ? anchor.y * 100 + 12 : imageRoomActorDepth({ y: anchor.y, z: node?.z ?? 0 }, 12)
      const container = this.add.container(pixel.x, pixel.y)
        .setDepth(depth)
        .setScale(roomAvatarScale(this.#roomId, anchor.y, Boolean(seat), seat?.id ?? null))
        .setData('avatarAction', action)
        .setData('avatarDirectionIndex', DIRECTIONS.indexOf(direction))
      const shadow = this.add.ellipse(0, 5, 34, 11, 0x020609, 0.35)
      shadow.setVisible(!seat)
      const layers: Phaser.GameObjects.Sprite[] = []
      const sheetFrame = DIRECTIONS.indexOf(direction) * ACTION_FRAMES[action]
      if (shouldUseCanonicalAvatar(appearance)) {
        layers.push(this.add.sprite(0, 0, canonicalAvatarTextureKey(action)).setOrigin(0.5, seat ? 1 : 0.88).setFrame(sheetFrame))
      } else {
        for (const layer of RENDERED_LAYERS) {
          const key = textureKey(layer, action, appearance)
          if (!key) continue
          const sprite = this.add.sprite(0, 0, key).setOrigin(0.5, seat ? 1 : 0.88).setFrame(sheetFrame)
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
        const target = pointer.event.target
        if (target instanceof Element && target.closest('[data-study-ui]')) return
        pointer.event.stopPropagation()
        window.dispatchEvent(new CustomEvent('radiotedu:study-player-selected', { detail: { presence } }))
      })
      this.#socialObjects.push(container)
      if (seat?.foregroundAsset && (this.#roomId === 'library' || this.#roomId === 'chim-alan')) {
        const asset = seat.foregroundAsset
        const foreground = this.add.image(asset.x, asset.y, `seat-foreground:${this.#roomId}:${seat.id}`)
          .setOrigin(0)
          .setDepth(imageRoomActorDepth(anchor, 20))
        this.#socialObjects.push(foreground)
      }
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
    const point = this.#seatedSeat
      ? resolveSeatGeometry(this.#room, this.#seatedSeat).actorAnchor
      : { x: (this.#avatar.x / this.#room.image.width) * 100, y: (this.#avatar.y / this.#room.image.height) * 100 }
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
    this.#avatar.clearMask(true)
    this.#seatActorMaskSource?.destroy()
    this.#seatActorMaskSource = null
    for (const object of this.#seatForegroundObjects) object.destroy()
    this.#seatForegroundObjects = []
    if (!seat) return

    const asset = seat.foregroundAsset
    if (this.#roomId === 'library' && asset?.url.startsWith('assets/study-gear/desk-01/')) {
      const geometry = resolveSeatGeometry(this.#room, seat)
      if (seat.facing === 'n') {
        const anchor = roomPointToPixel(this.#room, geometry.actorAnchor)
        const maskSource = this.make.graphics({ x: 0, y: 0, add: false } as never)
        maskSource.fillStyle(0xffffff).fillRect(anchor.x - 32, anchor.y - 96, 64, 72)
        this.#avatar.setMask(maskSource.createGeometryMask())
        this.#seatActorMaskSource = maskSource
      }
      const image = this.add.image(asset.x, asset.y, `seat-foreground:${this.#roomId}:${seat.id}`)
        .setOrigin(0)
        .setDepth(imageRoomActorDepth(geometry.actorAnchor, 20))
      this.#seatForegroundObjects.push(image)
      return
    }

    // The generated Library seat crops contain opaque carpet as well as the
    // chair edge. Drawing the whole crop over the actor erases their torso and
    // leaves a detached head and shoes. For the far side of an isometric desk,
    // restore only the narrow band that is physically in front of the seated
    // body. Near-side chairs need no foreground restoration.
    if (this.#roomId === 'library') {
      if (seat.facing !== 's') return
      const geometry = resolveSeatGeometry(this.#room, seat)
      const anchor = roomPointToPixel(this.#room, geometry.actorAnchor)
      const maskSource = this.make.graphics({ x: 0, y: 0, add: false } as never)
      // Phaser's 0.88 sprite origin leaves about 12 source pixels below the
      // ground anchor, so extend the restoration through that tail as well;
      // otherwise the shoes survive below the hidden seated legs.
      maskSource.fillStyle(0xffffff).fillRect(anchor.x - 38, anchor.y - 19, 76, 33)
      const image = this.add.image(0, 0, `room:${this.#roomId}`)
        .setOrigin(0)
        .setDepth(geometry.actorAnchor.y * 100 + 20)
        .setMask(maskSource.createGeometryMask())
      this.#seatForegroundObjects.push(image, maskSource)
      return
    }

    if (this.#roomId === 'auditorium') {
      const geometry = resolveSeatGeometry(this.#room, seat)
      const anchor = roomPointToPixel(this.#room, geometry.actorAnchor)
      const maskSource = this.make.graphics({ x: 0, y: 0, add: false } as never)
      // Restore only the chair-back/front band over the seated lower body.
      // The actor remains visible from the waist up, like a seated auditorium
      // occupant, while the surrounding aisle stays untouched.
      maskSource.fillStyle(0xffffff).fillRect(anchor.x - 40, anchor.y - 30, 80, 44)
      const image = this.add.image(0, 0, `room:${this.#roomId}`)
        .setOrigin(0)
        .setDepth(imageRoomActorDepth(geometry.actorAnchor, 20))
        .setMask(maskSource.createGeometryMask())
      this.#seatForegroundObjects.push(image, maskSource)
      return
    }

    if (this.#roomId === 'learning-lab') {
      const geometry = resolveSeatGeometry(this.#room, seat)
      const anchor = roomPointToPixel(this.#room, geometry.actorAnchor)
      const maskSource = this.make.graphics({ x: 0, y: 0, add: false } as never)
      // Every Pedagogy Lab chair is tucked under a real laboratory desk. Draw
      // only the desk-front band over the legs; head, shoulders, bent arms and
      // hands remain visible so the avatar reads as genuinely seated.
      maskSource.fillStyle(0xffffff).fillRect(anchor.x - 43, anchor.y - 24, 86, 39)
      const image = this.add.image(0, 0, `room:${this.#roomId}`)
        .setOrigin(0)
        .setDepth(imageRoomActorDepth(geometry.actorAnchor, 20))
        .setMask(maskSource.createGeometryMask())
      this.#seatForegroundObjects.push(image, maskSource)
      return
    }

    if (!asset) return
    const geometry = resolveSeatGeometry(this.#room, seat)
    const image = this.add.image(asset.x, asset.y, `seat-foreground:${this.#roomId}:${seat.id}`)
      .setOrigin(0)
      .setDepth(imageRoomActorDepth(geometry.actorAnchor, 20))
    this.#seatForegroundObjects.push(image)
  }

  #syncStudyDevice(): void {
    if (this.#studyDeviceGlow) this.tweens.killTweensOf(this.#studyDeviceGlow)
    this.#studyDevice?.destroy()
    this.#studyDevice = null
    this.#studyDeviceGlow?.destroy()
    this.#studyDeviceGlow = null
    const seat = this.#seatedSeat
    const laptop = studyGear.snapshot().equipped.laptop
    const socket = seat ? libraryDeviceSocket(seat.id) : null
    if (this.#roomId !== 'library' || !seat || !laptop || !socket) return
    const geometry = resolveSeatGeometry(this.#room, seat)
    const depth = imageRoomActorDepth(geometry.actorAnchor, socket.side === 'far' ? 32 : -4)
    this.#studyDevice = this.add.image(socket.x, socket.y, `study-device:${laptop}:${socket.side}`)
      .setOrigin(0.5, 1)
      .setDisplaySize(26, 15.6)
      .setDepth(depth)
      .setData('studyGearId', laptop)
    const glowColor = laptop === 'laptop-gold' ? 0xf2c94c : laptop === 'laptop-pro' ? 0x79d9e8 : 0x8ed9bd
    this.#studyDeviceGlow = this.add.ellipse(socket.x, socket.y - 10.5, 11, 4, glowColor, 0.18)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth + 1)
      .setData('studyGearId', laptop)
    this.tweens.add({
      targets: this.#studyDeviceGlow,
      alpha: { from: 0.14, to: 0.42 },
      scaleX: { from: 0.92, to: 1.06 },
      duration: 760,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })
  }

  #updateAvatarFrame(frameIndex: number): void {
    const action = this.#avatarController.action
    const direction = this.#avatarController.direction
    const seated = action === 'sit'
    const scale = roomAvatarScale(
      this.#roomId,
      (this.#avatar.y / this.#room.image.height) * 100,
      seated,
      this.#seatedSeat?.id ?? null,
    )
    this.#avatar.setScale(scale)
    this.#seatedUpperAvatar.setScale(scale)
    const frameCount = ACTION_FRAMES[action]
    const sheetFrame = DIRECTIONS.indexOf(direction) * frameCount + (frameIndex % frameCount)
    const orderedSlots = this.#avatarController.layers(frameIndex).map((layer) => layer.slot)
    this.#avatar.removeAll(false)
    this.#seatedUpperAvatar.removeAll(false)
    this.#seatedUpperAvatar.setPosition(this.#avatar.x, this.#avatar.y).setVisible(false)
    this.#canonicalAvatar.setVisible(false)
    this.#seatedUpperCanonical.setVisible(false)
    for (const sprite of this.#avatarSprites.values()) sprite.setVisible(false)
    for (const sprite of this.#seatedUpperSprites.values()) sprite.setVisible(false)
    if (shouldUseCanonicalAvatar(this.#avatarController.appearance)) {
      this.#canonicalAvatar.setPosition(0, 0).setOrigin(0.5, seated ? 1 : 0.88).setTexture(canonicalAvatarTextureKey(action), sheetFrame).setVisible(true)
      this.#avatar.add(this.#canonicalAvatar)
      return
    }
    for (const slot of orderedSlots) {
      const sprite = this.#avatarSprites.get(slot)
      const key = textureKey(slot, action, this.#avatarController.appearance)
      if (!sprite || !key) continue
      sprite.setPosition(0, 0).setOrigin(0.5, seated ? 1 : 0.88).setTexture(key, sheetFrame).setVisible(true)
      this.#avatar.add(sprite)
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

  #nearestNodeId(point: WorldPoint, z = this.#currentZ): string {
    return this.#room.nodes
      .filter((node) => node.z === z && !node.id.startsWith('approach:'))
      .map((node) => ({ node, pixel: roomPointToPixel(this.#room, node) }))
      .sort((left, right) => (
        Math.hypot(left.pixel.x - point.x, left.pixel.y - point.y)
        - Math.hypot(right.pixel.x - point.x, right.pixel.y - point.y)
      ))[0]?.node.id ?? this.#currentNodeId
  }

  #seatApproachPixel(seat: ImageRoomSeat): WorldPoint {
    const geometry = resolveSeatGeometry(this.#room, seat)
    const authored = roomPointToPixel(this.#room, geometry.approach)
    if (this.#navigationField.isWalkable(authored, geometry.approach.z)) return authored
    return this.#navigationField.nearestWalkable(authored, geometry.approach.z, 220) ?? authored
  }

  #routeToPoint(target: WorldPoint, targetZ: number, targetNodeId?: string): readonly Readonly<{ id: string; x: number; y: number; z: number }>[] {
    const start = { x: this.#avatar.x, y: this.#avatar.y }
    const direct = this.#currentZ === targetZ ? this.#navigationField.findPath(start, target, targetZ) : []
    if (direct.length > 0) {
      const route = direct.map((point, index) => ({
        id: index === direct.length - 1 ? (targetNodeId ?? `point:${Math.round(point.x)}:${Math.round(point.y)}`) : `field:${index}`,
        x: point.x,
        y: point.y,
        z: targetZ,
      }))
      const endpoint = route[route.length - 1]!
      if (
        Math.hypot(endpoint.x - target.x, endpoint.y - target.y) > 0.5
        && this.#navigationField.segmentIsWalkable(endpoint, target, targetZ)
      ) {
        route.push({ id: targetNodeId ?? `point:${Math.round(target.x)}:${Math.round(target.y)}`, x: target.x, y: target.y, z: targetZ })
      }
      return route
    }

    const goalNodeId = targetNodeId ?? this.#nearestNodeId(target, targetZ)
    const legacyIds = this.#graph.findPath(this.#currentNodeId, goalNodeId)
    if (legacyIds.length === 0) return []
    const route: Array<{ id: string; x: number; y: number; z: number }> = [
      { id: 'field:start', x: start.x, y: start.y, z: this.#currentZ },
    ]
    for (let index = 0; index < legacyIds.length; index += 1) {
      const node = this.#graph.node(legacyIds[index]!)!
      const pixel = roomPointToPixel(this.#room, node)
      const previous = route[route.length - 1]!
      if (previous.z === node.z) {
        const fieldSection = this.#navigationField.findPath(previous, pixel, node.z)
        if (fieldSection.length === 0) return []
        for (const [fieldIndex, point] of fieldSection.slice(1).entries()) {
          route.push({ id: fieldIndex === fieldSection.length - 2 ? node.id : `field:${index}:${fieldIndex}`, x: point.x, y: point.y, z: node.z })
        }
      } else {
        route.push({ id: node.id, x: pixel.x, y: pixel.y, z: node.z })
      }
    }
    const tail = route[route.length - 1]!
    if (Math.hypot(tail.x - target.x, tail.y - target.y) > 1) {
      const finalSection = this.#navigationField.findPath(tail, target, targetZ)
      if (finalSection.length === 0) return []
      for (const [index, point] of finalSection.slice(1).entries()) {
        route.push({ id: index === finalSection.length - 2 ? goalNodeId : `field:goal:${index}`, x: point.x, y: point.y, z: targetZ })
      }
    }
    const endpoint = route[route.length - 1]!
    if (
      Math.hypot(endpoint.x - target.x, endpoint.y - target.y) > 0.5
      && this.#navigationField.segmentIsWalkable(endpoint, target, targetZ)
    ) {
      route.push({ id: targetNodeId ?? goalNodeId, x: target.x, y: target.y, z: targetZ })
    }
    return route
  }

  async #walkToNode(
    targetId: string,
    activityToken: ActivityToken = this.#activity.beginWalk(),
    beforeRoute?: () => Promise<boolean>,
  ): Promise<void> {
    const node = this.#graph.node(targetId)
    if (!node) throw new Error(`Unknown navigation node ${this.#roomId}:${targetId}`)
    return this.#walkToPoint(roomPointToPixel(this.#room, node), node.z, activityToken, beforeRoute, targetId)
  }

  async #walkToPoint(
    target: WorldPoint,
    targetZ: number = this.#navigationField.layerAt(target, this.#currentZ) ?? this.#currentZ,
    activityToken: ActivityToken = this.#activity.beginWalk(),
    beforeRoute?: () => Promise<boolean>,
    targetNodeId?: string,
  ): Promise<void> {
    const resumeState = this.#activity.snapshot().state
    this.#cancelActiveRoute()
    if (!this.#activity.isCurrent(activityToken)) return
    if (this.#seatedSeat || this.#standPromise) {
      this.#activity.transition(activityToken, 'standing')
      await this.stand(activityToken)
      if (!this.#activity.isCurrent(activityToken)) return
      this.#activity.transition(activityToken, resumeState)
    }
    if (beforeRoute && !(await beforeRoute())) return
    if (!this.#activity.isCurrent(activityToken)) return

    const routePoints = [...this.#routeToPoint(target, targetZ, targetNodeId)]
    if (routePoints.length < 2) {
      if (Math.hypot(target.x - this.#avatar.x, target.y - this.#avatar.y) > 3) throw new Error('Target is not reachable')
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
        this.#activeSegmentFromId = sample.from.id
        this.#activeSegmentToId = sample.to.id
        this.#avatarController.applyMovement(sample.direction)
        this.#setState(sample.from.z !== sample.to.z ? 'stair' : 'walking')
      }
      this.#avatar.setPosition(sample.x, sample.y)
      this.#shadow.setPosition(sample.x, sample.y + 5)
      this.#currentZ = sample.z
      this.#updateAvatarFrame(walkFrameAtDistance(sample.distance, ACTION_FRAMES.walk, AVATAR_WALK_STRIDE))
      this.#setAvatarDepth({ y: (sample.y / this.#room.image.height) * 100, z: sample.z })
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
          if (this.#routeTween === routeTween) this.#routeTween = null
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
    // Phaser can complete a long tween between update ticks on constrained
    // mobile devices. Sample the exact endpoint once so the avatar cannot
    // stop several world units short while the activity already says ready.
    travel.elapsedMs = durationMs
    updateMotion()
    this.#activeSegmentFromId = null
    this.#activeSegmentToId = null
    this.#currentZ = targetZ
    this.#currentNodeId = targetNodeId ?? this.#nearestNodeId(target, targetZ)
    this.#avatarController.applyMovement({ x: 0, y: 0 })
    this.#updateAvatarFrame(0)
    this.#setState('ready')
    if (resumeState === 'walking') this.#activity.transition(activityToken, 'idle')
    void this.#pushPresence()
  }

  #cancelActiveRoute(): void {
    if (!this.#routeTween) return
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

    // The unchanged room art already contains a dark 270×116 pixel stage
    // screen at x=721..991, y=122..238. Keep event content inside those
    // source-pixel bounds so it never floats over the audience seating.
    const eventScreen = AUDITORIUM_EVENT_SCREEN_BOUNDS
    const halfScreenWidth = eventScreen.width / 2
    const halfScreenHeight = eventScreen.height / 2
    const screen = this.add.container(
      eventScreen.x + halfScreenWidth,
      eventScreen.y + halfScreenHeight,
    ).setDepth(-90_000)
    const shell = this.add.graphics()
    shell.fillStyle(0x04080f, 0.96).fillRoundedRect(-halfScreenWidth, -halfScreenHeight, eventScreen.width, eventScreen.height, 5)
    shell.lineStyle(3, 0x172a3b, 1).strokeRoundedRect(-halfScreenWidth, -halfScreenHeight, eventScreen.width, eventScreen.height, 5)
    shell.lineStyle(1, 0x57e7ff, 0.72).strokeRoundedRect(-127, -50, 254, 100, 3)
    for (let y = -44; y <= 44; y += 6) {
      shell.lineStyle(1, 0x66ddeb, 0.08).lineBetween(-122, y, 122, y)
    }

    const cornerPixels = this.add.graphics()
    cornerPixels.fillStyle(0xffcc4d, 1)
      .fillRect(-125, -48, 14, 3).fillRect(-125, -48, 3, 14)
      .fillRect(111, -48, 14, 3).fillRect(122, -48, 3, 14)
      .fillRect(-125, 45, 14, 3).fillRect(-125, 34, 3, 14)
      .fillRect(111, 45, 14, 3).fillRect(122, 34, 3, 14)

    const signal = this.add.graphics().setPosition(-98, 18).setScale(0.55)
    signal.fillStyle(0xff334f, 1).fillCircle(0, 15, 4)
    signal.lineStyle(3, 0xff334f, 1)
    for (const radius of [11, 18, 25]) {
      signal.beginPath().arc(0, 15, radius, Phaser.Math.DegToRad(285), Phaser.Math.DegToRad(355), false).strokePath()
    }

    const eyebrow = this.add.text(0, -36, '', {
      color: '#ffcc4d', fontFamily: 'monospace', fontSize: '8px', fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5)
    const title = this.add.text(0, -5, '', {
      color: '#ffffff', fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', align: 'center',
      stroke: '#0b111a', strokeThickness: 2,
    }).setOrigin(0.5)
    const subtitle = this.add.text(0, 20, '', {
      color: '#9fffea', fontFamily: 'monospace', fontSize: '7px', fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5)
    const ticker = this.add.text(0, 39, '● LIVE  •  TEDU CAMPUS  •  EVENTS  •  STUDY', {
      color: '#d8f8f2', fontFamily: 'monospace', fontSize: '6px',
    }).setOrigin(0.5)
    const scanline = this.add.rectangle(0, -45, 238, 3, 0x8ffff0, 0.2)

    screen.add([shell, cornerPixels, signal, eyebrow, title, subtitle, ticker, scanline])
    this.#roomObjects.push(screen)
    this.tweens.add({ targets: scanline, y: 45, duration: 1500, repeat: -1, ease: 'Linear' })
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
    const geometry = resolveSeatGeometry(this.#room, seat)
    const approachPixel = this.#seatApproachPixel(seat)
    try {
      await this.#walkToPoint(approachPixel, geometry.approach.z, activityToken, async () => {
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
      }, seat.approachNodeId)
      if (!this.#activity.isCurrent(activityToken)
        || Math.hypot(approachPixel.x - this.#avatar.x, approachPixel.y - this.#avatar.y) > 5
        || this.#roomId !== roomId) return
      this.#activity.transition(activityToken, 'aligning-seat')
      await this.#sit(seat, activityToken)
      if (!this.#activity.isCurrent(activityToken)) return
      this.#seatReservations.occupy(roomId, seat.id, ownerId)
      seated = true
      await this.#sessionTracker?.seated(roomId, seat.id, { x: geometry.actorAnchor.x, y: geometry.actorAnchor.y })
      void this.#pushPresence()
    } finally {
      if (adapterReserved && !seated) {
        this.#seatReservations.release(roomId, seat.id, ownerId)
        await this.#adapter.releaseSeat()
      }
    }
  }

  async #sit(seat: ImageRoomSeat, activityToken: ActivityToken): Promise<void> {
    // Library tables run on the isometric NE/SW axis. Cardinal N/S sit frames
    // look like a standing avatar pasted against a chair even at a correct
    // anchor, so use the matching diagonal pose proved against the room art.
    const usesAcceptedSeatAsset = this.#roomId === 'library'
      && seat.foregroundAsset?.url.startsWith('assets/study-gear/desk-01/')
    const facing = usesAcceptedSeatAsset
      ? seat.facing
      : this.#roomId === 'library' || this.#roomId === 'chim-alan'
      ? seat.facing === 'n' ? 'ne' : seat.facing === 's' ? 'sw' : seat.facing
      : seat.facing
    this.#avatarController.applyMovement(FACING_DELTA[facing])
    const geometry = resolveSeatGeometry(this.#room, seat)
    const sitPixel = roomPointToPixel(this.#room, geometry.actorAnchor)
    this.#setState('sitting')
    // A Habbo-style seat change is an atomic asset-state update: the actor
    // reaches the adjacent floor approach, then the renderer changes both the
    // pose and its authored chair anchor in the same frame. Interpolating a
    // full standing body between these two points makes it glide through the
    // chair or desk even though the navigation route itself is collision-safe.
    this.#avatarController.sit()
    this.#avatar.setPosition(sitPixel.x, sitPixel.y)
    this.#shadow.setVisible(false)
    this.#seatedSeat = seat
    this.#activity.transition(activityToken, 'seated')
    this.#setState('seated')
    document.documentElement.dataset.seatedSeatId = seat.id
    this.#currentZ = geometry.actorAnchor.z
    this.#setAvatarDepth(geometry.actorAnchor)
    this.#setSeatForeground(seat)
    this.#syncStudyDevice()
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
    const geometry = resolveSeatGeometry(this.#room, seat)
    const approach = geometry.approach
    const pixel = this.#seatApproachPixel(seat)
    this.#seatedSeat = null
    delete document.documentElement.dataset.seatedSeatId
    const finishSession = this.#sessionTracker?.stood() ?? Promise.resolve()
    this.#seatReservations.release(this.#roomId, seat.id, this.#adapter.session().account.id)
    const releaseSeat = this.#adapter.releaseSeat()
    // Move to the authored floor approach before selecting any standing
    // frame. This prevents the transient full-height avatar from being drawn
    // on top of the chair/table anchor while standing up.
    this.#avatar.setPosition(pixel.x, pixel.y)
    this.#shadow.setPosition(pixel.x, pixel.y + 5).setVisible(true)
    this.#currentZ = approach.z
    this.#currentNodeId = seat.approachNodeId
    this.#setAvatarDepth(approach)
    this.#setSeatForeground(null)
    this.#syncStudyDevice()
    this.#avatarController.stand()
    this.#setState('standing')
    for (let frame = 0; frame < ACTION_FRAMES.stand; frame += 1) {
      this.#updateAvatarFrame(frame)
      await new Promise<void>((resolve) => this.time.delayedCall(90, () => resolve()))
    }
    this.#avatarController.applyMovement({ x: 0, y: 0 })
    this.#updateAvatarFrame(0)
    await Promise.all([finishSession, releaseSeat])
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
      const purchased = await this.#adapter.purchaseWearable(id, globalThis.crypto?.randomUUID?.() ?? `wardrobe-${Date.now()}-${id}`)
      studyGear.synchronizeGold(purchased.points.global)
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
    if (this.#intentMarker) {
      this.tweens.killTweensOf(this.#intentMarker)
      this.#intentMarker.destroy()
    }
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
        if (marker.active) marker.destroy()
      },
    })
  }

  #bindPointerMovement(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const world = { x: pointer.worldX, y: pointer.worldY }
      const target = pointer.event.target
      const pointerType = 'pointerType' in pointer.event ? String(pointer.event.pointerType) : 'mouse'
      const canvasBounds = this.game.canvas.getBoundingClientRect()
      const screenSlop = pointerType === 'touch' ? TOUCH_SEAT_HIT_SLOP_PX : MOUSE_SEAT_HIT_SLOP_PX
      const seatHitSlop = screenSlop * Math.max(
        this.cameras.main.worldView.width / Math.max(1, canvasBounds.width),
        this.cameras.main.worldView.height / Math.max(1, canvasBounds.height),
      )
      this.#pendingPointerIntent = {
        world,
        uiConsumed: target instanceof Element && Boolean(target.closest('[data-study-ui]')),
        seatHitSlop,
      }
      if (this.#pointerIntentFrame !== null) return
      this.#pointerIntentFrame = window.requestAnimationFrame(() => {
        this.#pointerIntentFrame = null
        const pending = this.#pendingPointerIntent
        this.#pendingPointerIntent = null
        if (pending) this.#processPointerIntent(pending.world, pending.uiConsumed, pending.seatHitSlop)
      })
    })
  }

  #processPointerIntent(world: TouchWorldPoint, uiConsumed: boolean, seatHitSlop: number): void {
    const accountId = this.#adapter.session().account.id
    const presence = this.#adapter.presence(this.#roomId)
    this.#syncSeatReservations(presence)
    const players = presence.flatMap((person) => {
      if (person.userId === accountId) return []
      const seat = person.seatId ? this.#room.seats.find((candidate) => candidate.id === person.seatId) : null
      const anchor = seat
        ? resolveSeatGeometry(this.#room, seat).actorAnchor
        : person.position ?? this.#graph.node(person.nodeId)
      return anchor ? [{ userId: person.userId, ...roomPointToPixel(this.#room, anchor) }] : []
    })
    const pointsAtPlayer = players.some((player) => Math.hypot(player.x - world.x, player.y - world.y) <= 44)
    const seatTargets = this.#room.seats.map((seat) => ({
      seat,
      hitArea: resolveSeatGeometry(this.#room, seat).hitArea.map((point) => roomPointToPixel(this.#room, point)),
    }))
    const hitSeat = pointsAtPlayer
      ? null
      : resolveSeatHitTarget(world, seatTargets, seatHitSlop)?.seat ?? null

    // A seated anchor is intentionally inside the furniture footprint. Plan
    // the next action from its standing approach, without searching the whole
    // navigation field for every chair on every click.
    const intentStart = this.#seatedSeat
      ? this.#seatApproachPixel(this.#seatedSeat)
      : { x: this.#avatar.x, y: this.#avatar.y }
    const targetZ = this.#navigationField.layerAt(world, this.#currentZ)
    const pointsAtFurniture = !hitSeat
      && roomInteractionObstacles(this.#room).some((polygon) => pointInPolygon(world, polygon))
    const walkable = uiConsumed || pointsAtPlayer || hitSeat !== null
      ? false
      : !pointsAtFurniture && targetZ !== null && (
          targetZ === this.#currentZ
            ? this.#navigationField.findPath(intentStart, world, targetZ).length > 0
            : this.#graph.findPath(this.#currentNodeId, this.#nearestNodeId(world, targetZ)).length > 0
        )
    const seats = hitSeat ? [(() => {
      const geometry = resolveSeatGeometry(this.#room, hitSeat)
      const approach = this.#seatApproachPixel(hitSeat)
      const reachable = geometry.approach.z === this.#currentZ
        ? this.#navigationField.findPath(intentStart, approach, geometry.approach.z).length > 0
        : this.#nodeIsReachable(hitSeat.approachNodeId)
      return {
        id: hitSeat.id,
        target: roomPointToPixel(this.#room, geometry.actorAnchor),
        hitArea: geometry.hitArea.map((point) => roomPointToPixel(this.#room, point)),
        reachable,
        occupied: !this.#seatReservations.isAvailable(this.#roomId, hitSeat.id, accountId),
      }
    })()] : []
    const intent = resolveTouchIntent({
      world,
      uiConsumed,
      currentSeatId: this.#seatedSeat?.id ?? null,
      activeSeatIntentId: this.#activity.snapshot().activeSeatId,
      walkable,
      seats,
      players,
      seatHitSlop,
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
      this.#showActionError(intent.reason === 'occupied-seat' ? 'SEAT TAKEN' : 'CHOOSE ANOTHER SPOT')
      return
    }
    if (intent.kind === 'sit') {
      void this.walkToSeat(intent.seatId).catch(() => this.#showActionError('SEAT UNAVAILABLE'))
      return
    }
    const layer = this.#navigationField.layerAt(intent.target, this.#currentZ)
    if (layer === null) return
    this.#lastWalkTarget = { ...intent.target }
    void this.#walkToPoint(intent.target, layer).catch(() => this.#showActionError('CHOOSE ANOTHER SPOT'))
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
    if (pointBalance) pointBalance.textContent = String(studyGear.snapshot().gold)
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
      walkToPoint: (x, y) => {
        const point = { x, y }
        const z = this.#navigationField.layerAt(point, this.#currentZ)
        if (z === null) return Promise.reject(new Error('Point is outside the navigation field'))
        return this.#walkToPoint(point, z)
      },
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
        const blockers: Array<{ id: string; kind: 'actor' | 'cat' | 'player'; radius: number; world: { x: number; y: number }; screen: { x: number; y: number } }> = []
        for (const [id, actor] of Object.entries(this.#room.actors)) {
          if (!actor) continue
          const node = this.#graph.node(actor.nodeId)
          if (!node) continue
          const world = roomPointToPixel(this.#room, node)
          blockers.push({ id, kind: 'actor', radius: 105, world, screen: screen(world) })
        }
        for (const cat of this.#campusCats) {
          const world = { x: cat.sprite.x, y: cat.sprite.y }
          blockers.push({ id: cat.name, kind: 'cat', radius: 34, world, screen: screen(world) })
        }
        for (const presence of this.#adapter.presence(this.#roomId)) {
          const seat = presence.seatId ? this.#room.seats.find((candidate) => candidate.id === presence.seatId) : null
          const anchor = seat
            ? resolveSeatGeometry(this.#room, seat).actorAnchor
            : presence.position ?? this.#graph.node(presence.nodeId)
          if (!anchor) continue
          const world = roomPointToPixel(this.#room, anchor)
          blockers.push({ id: presence.userId, kind: 'player', radius: 55, world, screen: screen(world) })
        }
        return {
          floor: this.#navigationField.layerIds().flatMap((z) => (
            this.#navigationField.samples(z, 8).map((world, index) => ({
              id: `floor:${z}:${index}`,
              z,
              world,
              screen: screen(world),
            }))
          )),
          nodes: this.#room.nodes.map((node) => {
            const world = roomPointToPixel(this.#room, node)
            return { id: node.id, reachable: this.#nodeIsReachable(node.id), world, screen: screen(world) }
          }),
          seats: this.#room.seats.map((seat) => {
            const geometry = resolveSeatGeometry(this.#room, seat)
            const world = roomPointToPixel(this.#room, geometry.actorAnchor)
            const hitArea = geometry.hitArea.map((point) => roomPointToPixel(this.#room, point))
            return {
              id: seat.id,
              reachable: this.#nodeIsReachable(seat.approachNodeId),
              occupied: !this.#seatReservations.isAvailable(this.#roomId, seat.id, accountId),
              world,
              approach: this.#seatApproachPixel(seat),
              hitArea,
              hitAreaScreen: hitArea.map(screen),
              screen: screen(world),
            }
          }),
          blockers,
        }
      },
      navigation: () => {
        const geometry = roomNavigationGeometry(this.#room)
        return {
          cellSize: this.#navigationField.cellSize,
          clearance: this.#navigationField.clearance,
          layers: geometry.layers,
          obstacles: geometry.obstacles,
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
        lastWalkTarget: this.#lastWalkTarget ? { ...this.#lastWalkTarget } : null,
        z: this.#currentZ,
        cats: this.#campusCats.map((cat) => ({
          name: cat.name,
          position: { x: cat.sprite.x, y: cat.sprite.y },
          shadowPosition: { x: cat.shadow.x, y: cat.shadow.y - 2 },
          frame: cat.frame,
          walking: cat.walking,
          z: cat.z,
        })),
        hatId: this.#avatarController.appearance.hatId,
        topId: this.#avatarController.appearance.topId,
        bottomId: this.#avatarController.appearance.bottomId,
        shoesId: this.#avatarController.appearance.shoesId,
        layerTextures: Object.fromEntries(
          [...this.#avatarSprites].map(([slot, sprite]) => [slot, sprite.visible ? sprite.texture.key : null]),
        ) as Partial<Record<AvatarLayerSlot, string | null>>,
        studyDeviceTexture: this.#studyDevice?.texture.key ?? null,
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
    // Mirror only the semantic seat click geometry into DOM metadata so visual
    // browser recordings can choose a real canvas pixel without invoking the
    // imperative debug seating command.
    document.documentElement.dataset.seatTapTargets = JSON.stringify(
      window.__STUDY_GAME_APP__.tapTargets().seats,
    )
  }
}

declare global {
  interface Window {
    __STUDY_GAME_APP__: {
      switchRoom(roomId: ImageRoomId): Promise<void>
      walkToNode(nodeId: string): Promise<void>
      walkToPoint(x: number, y: number): Promise<void>
      moveByDirection(x: number, y: number): Promise<void>
      walkToSeat(seatId: string): Promise<void>
      stand(): Promise<void>
      equip(slot: WardrobeSlot, id: string): Promise<void>
      tapTargets(): {
        floor: Array<{
          id: string
          z: number
          world: { x: number; y: number }
          screen: { x: number; y: number }
        }>
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
          approach: { x: number; y: number }
          hitArea: Array<{ x: number; y: number }>
          hitAreaScreen: Array<{ x: number; y: number }>
          screen: { x: number; y: number }
        }>
        blockers: Array<{
          id: string
          kind: 'actor' | 'cat' | 'player'
          radius: number
          world: { x: number; y: number }
          screen: { x: number; y: number }
        }>
      }
      navigation(): {
        cellSize: number
        clearance: number
        layers: readonly Readonly<{ z: number; walkable: readonly (readonly WorldPoint[])[] }>[]
        obstacles: readonly (readonly WorldPoint[])[]
      }
      snapshot(): {
        roomId: ImageRoomId
        state: GameState
        nodeId: string
        activeSegment: { fromId: string; toId: string } | null
        seatId: string | null
        position: { x: number; y: number }
        lastWalkTarget: { x: number; y: number } | null
        z: number
        cats: Array<{
          name: string
          position: { x: number; y: number }
          shadowPosition: { x: number; y: number }
          frame: number
          walking: boolean
          z: number
        }>
        hatId: string | null
        topId: string
        bottomId: string
        shoesId: string
        layerTextures: Partial<Record<AvatarLayerSlot, string | null>>
        studyDeviceTexture: string | null
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
