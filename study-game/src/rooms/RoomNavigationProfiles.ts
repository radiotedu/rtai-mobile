import type { NavigationFieldGeometry, WorldPoint } from '../pathfinding/RoomNavigationField'
import type { ImageRoomDefinition, ImageRoomId } from './ImageRoomDefinition'
import chimAlanLayout from './data/chim-alan-amphitheatre-layout.json'

type PercentPoint = readonly [number, number]
type PercentPolygon = readonly PercentPoint[]
type PercentLayer = Readonly<{ z: number; walkable: readonly PercentPolygon[] }>
type PercentProfile = Readonly<{
  layers: readonly PercentLayer[]
  obstacles?: readonly PercentPolygon[]
  interactionObstacles?: readonly PercentPolygon[]
}>

type PixelPolygon = readonly (readonly [number, number])[]
type ChimAlanLayout = Readonly<{
  rows: readonly Readonly<{ z: number; surface: PixelPolygon }>[]
  navigation: Readonly<{
    ground: PixelPolygon
    courtyard: PixelPolygon
    obstacles: readonly PixelPolygon[]
    interactionObstacles: readonly PixelPolygon[]
  }>
}>

const CHIM_ALAN_LAYOUT = chimAlanLayout as unknown as ChimAlanLayout

const LIBRARY_TABLETOPS: readonly PercentPolygon[] = Object.freeze([
  [[50.36, 23.38], [53.53, 20.19], [68.48, 34.33], [65.31, 37.94]],
  [[39.53, 30.50], [42.88, 27.10], [58.49, 44.85], [55.14, 48.46]],
  [[28.59, 40.70], [31.64, 37.19], [47.37, 52.92], [44.02, 56.54]],
  [[14.71, 49.20], [18.06, 45.90], [33.55, 61.96], [30.20, 65.57]],
  [[57.00, 59.50], [60.00, 55.90], [76.00, 72.10], [72.70, 75.60]],
  [[44.32, 68.20], [47.55, 64.72], [62.98, 80.66], [59.63, 84.27]],
])

// The bookcase-like end cabinets are deeper than the tabletops. Keeping them
// separate preserves the chair aisles while preventing the avatar's body from
// visually crossing a desk end even when its ground anchor is just outside the
// tabletop polygon.
const LIBRARY_TABLE_END_CAPS: readonly PercentPolygon[] = Object.freeze([
  [[65.00, 34.00], [68.50, 32.70], [70.40, 36.60], [70.40, 42.50], [66.80, 44.40], [65.00, 40.60]],
  [[54.80, 45.80], [58.40, 44.70], [58.40, 50.80], [55.30, 52.60], [53.90, 48.60]],
  [[43.80, 53.80], [47.70, 52.50], [47.70, 59.20], [44.80, 60.80], [43.50, 56.80]],
  [[30.00, 62.20], [33.80, 60.80], [33.80, 68.70], [30.60, 70.10], [29.40, 66.20]],
  [[72.50, 72.00], [76.60, 70.80], [76.60, 78.40], [73.40, 80.00], [72.00, 76.20]],
  [[59.40, 80.20], [63.90, 78.90], [63.90, 87.50], [60.40, 89.50], [59.00, 85.40]],
])

const LIBRARY_TABLE_END_BODY_CLEARANCE: readonly PercentPolygon[] = Object.freeze([
  [[28.90, 66.00], [30.60, 70.10], [33.80, 68.70], [33.80, 71.80], [29.90, 74.10], [28.30, 68.20]],
])

const PROFILES: Readonly<Record<ImageRoomId, PercentProfile>> = Object.freeze({
  library: {
    layers: [{ z: 0, walkable: [[
      [1, 48], [8, 37], [34, 18], [68, 15], [98, 35], [99, 69],
      [87, 84], [62, 96], [27, 91], [3, 73],
    ]] }],
    // Exact visible tabletop footprints. The route field must treat the full
    // isometric surface as solid; using only the near edge made an otherwise
    // valid A* segment appear to walk over the desk in the flattened artwork.
    obstacles: [
      ...LIBRARY_TABLETOPS,
      ...LIBRARY_TABLE_END_CAPS,
      ...LIBRARY_TABLE_END_BODY_CLEARANCE,
      [[0, 27.630], [36.124, 18.704], [37.081, 36.132], [0, 56.961]],
      [[34.20, 26.90], [37.30, 26.90], [37.30, 41.40], [34.20, 41.40]],
      [[37.60, 24.60], [40.10, 24.60], [40.10, 36.10], [37.60, 36.10]],
      [[66.089, 18.916], [95.215, 36.769], [96.172, 61.849], [69.976, 53.454]],
    ],
    // Pointer targets use the visible tabletop surfaces, not just their
    // narrow ground-contact footprints. This keeps a desk click from being
    // interpreted as a reachable floor destination while leaving the chair
    // approach aisles available to A*.
    interactionObstacles: [...LIBRARY_TABLETOPS, ...LIBRARY_TABLE_END_CAPS, ...LIBRARY_TABLE_END_BODY_CLEARANCE],
  },
  'chim-alan': {
    layers: [
      { z: 0, walkable: [[[28, 50], [58, 50], [63, 96], [38, 99], [25, 67]]] },
      { z: 1, walkable: [[[31, 44], [84, 42], [84, 52], [31, 54]]] },
      { z: 2, walkable: [[[31, 37], [84, 35], [84, 45], [31, 47]]] },
      { z: 3, walkable: [[[28, 17], [84, 17], [86, 37], [29, 40]]] },
    ],
  },
  'sports-center': {
    layers: [{ z: 0, walkable: [[
      [1, 29], [27, 5], [63, 3], [98, 28], [99, 95], [1, 96],
    ]] }],
    obstacles: [
      [[13, 24], [33, 22], [34, 39], [15, 44]],
      [[2, 44], [14, 40], [14, 76], [2, 82]],
      [[17, 51], [25, 49], [25, 77], [17, 80]],
      [[29, 40], [36, 39], [37, 61], [29, 63]],
      [[40, 46], [48, 45], [49, 59], [40, 60]],
      [[50, 48], [58, 47], [59, 58], [50, 60]],
      [[45, 67], [58, 61], [61, 67], [48, 74]],
      [[34, 64], [44, 63], [45, 72], [34, 73]],
      [[44, 80], [58, 79], [59, 88], [45, 90]],
      [[78, 49], [92, 46], [93, 61], [79, 64]],
      [[80, 68], [96, 67], [96, 79], [80, 81]],
      [[31, 27], [67, 17], [73, 41], [47, 45]],
    ],
  },
  auditorium: {
    layers: [
      { z: 0, walkable: [
        [[4, 84], [96, 84], [96, 94], [4, 94]],
        [[7, 31], [93, 31], [93, 42], [7, 42]],
        [[3, 35], [14, 35], [11, 88], [2, 88]],
        [[31, 35], [41, 35], [39, 88], [27, 88]],
        [[59, 35], [70, 35], [74, 88], [62, 88]],
        [[86, 35], [97, 35], [99, 88], [90, 88]],
      ] },
      { z: 1, walkable: [[[37, 16], [80, 16], [80, 35], [37, 35]]] },
    ],
    obstacles: [
      [[12, 38], [34, 38], [30, 86], [10, 84]],
      [[39, 38], [61, 38], [65, 86], [37, 86]],
      [[69, 38], [88, 39], [92, 85], [71, 85]],
      [[48, 21], [55, 21], [55, 31], [48, 31]],
    ],
    interactionObstacles: [
      [[12, 38], [34, 38], [30, 86], [10, 84]],
      [[39, 38], [61, 38], [65, 86], [37, 86]],
      [[69, 38], [88, 39], [92, 85], [71, 85]],
      [[48, 21], [55, 21], [55, 31], [48, 31]],
    ],
  },
  'learning-lab': {
    layers: [{ z: 0, walkable: [[
      [6, 56], [18, 46], [45, 28], [65, 31], [96, 55], [98, 83], [73, 98], [22, 98], [6, 78],
    ]] }],
    obstacles: [
      [[17, 50], [38, 61], [37, 66], [16, 55]],
      [[35, 40], [56, 50], [55, 55], [34, 45]],
      [[47, 31], [66, 41], [65, 46], [46, 36]],
      [[50, 53], [68, 63], [67, 69], [49, 59]],
      [[63, 39], [84, 49], [83, 61], [62, 51]],
      [[87, 37], [100, 43], [100, 57], [87, 51]],
    ],
  },
})

function toPixels(room: ImageRoomDefinition, polygon: PercentPolygon): readonly WorldPoint[] {
  return polygon.map(([x, y]) => ({
    x: (x / 100) * room.image.width,
    y: (y / 100) * room.image.height,
  }))
}

export function roomNavigationGeometry(room: ImageRoomDefinition): NavigationFieldGeometry {
  if (room.id === 'chim-alan') {
    const rowLayers = CHIM_ALAN_LAYOUT.rows.map((row) => ({
      z: row.z,
      walkable: [row.surface.map(([x, y]) => ({ x, y }))],
    }))
    const elevated = rowLayers.map((layer) => layer.z === 3
      ? { ...layer, walkable: [...layer.walkable, CHIM_ALAN_LAYOUT.navigation.courtyard.map(([x, y]) => ({ x, y }))] }
      : layer)
    return Object.freeze({
      layers: Object.freeze([
        Object.freeze({
          z: 0,
          walkable: Object.freeze([CHIM_ALAN_LAYOUT.navigation.ground.map(([x, y]) => ({ x, y }))]),
        }),
        ...elevated.map((layer) => Object.freeze({
          z: layer.z,
          walkable: Object.freeze(layer.walkable.map((polygon) => Object.freeze(polygon))),
        })),
      ]),
      obstacles: Object.freeze(CHIM_ALAN_LAYOUT.navigation.obstacles.map((polygon) => Object.freeze(
        polygon.map(([x, y]) => Object.freeze({ x, y })),
      ))),
    })
  }
  const profile = PROFILES[room.id]
  const navigationOccluders = room.id === 'library'
    ? []
    : room.occluders
  return Object.freeze({
    layers: profile.layers.map((layer) => Object.freeze({
      z: layer.z,
      walkable: layer.walkable.map((polygon) => toPixels(room, polygon)),
    })),
    obstacles: [
      ...(profile.obstacles ?? []).map((polygon) => toPixels(room, polygon)),
      ...navigationOccluders.map((occluder) => toPixels(room, occluder.points.map((point) => [point.x, point.y] as const))),
    ],
  })
}

export function roomInteractionObstacles(room: ImageRoomDefinition): readonly (readonly WorldPoint[])[] {
  if (room.id === 'chim-alan') {
    return CHIM_ALAN_LAYOUT.navigation.interactionObstacles.map((polygon) => (
      polygon.map(([x, y]) => ({ x, y }))
    ))
  }
  const profile = PROFILES[room.id]
  return (profile.interactionObstacles ?? profile.obstacles ?? []).map((polygon) => toPixels(room, polygon))
}
