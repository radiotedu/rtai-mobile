import type { NavigationNode } from '../pathfinding/NavigationGraph'
import type { ImageRoomId } from './ImageRoomDefinition'

type NodePoint = Readonly<{ x: number; y: number; z?: number }>

// Stable backend/script IDs are preserved while legacy points that landed
// inside inflated furniture are moved to the nearest intentional aisle cell.
const OVERRIDES: Readonly<Partial<Record<ImageRoomId, Readonly<Record<string, NodePoint>>>>> = Object.freeze({
  library: Object.freeze({
    entrance: { x: 45.22, y: 82.89 },
    'stair-bottom': { x: 41.87, y: 82.04 },
    'bottom-center-aisle': { x: 41.87, y: 81.83 },
    'lower-center-aisle': { x: 47.13, y: 73.54 },
    'lower-right-aisle': { x: 74.40, y: 76.09 },
    'middle-left-aisle': { x: 20.33, y: 57.39 },
    'upper-left-aisle': { x: 30.86, y: 45.48 },
    'upper-center-aisle': { x: 55.26, y: 38.68 },
    'upper-right-aisle': { x: 67.70, y: 43.78 },
    lounge: { x: 82.54, y: 26.78 },
    'right-lounge': { x: 81.10, y: 59.09 },
    'right-lower-lounge': { x: 81.10, y: 59.09 },
    'right-spine-mid': { x: 95.45, y: 64.19 },
    'right-spine-upper': { x: 89.23, y: 61.64 },
    'right-upper-link': { x: 78.71, y: 58.24 },
    'right-lounge-link': { x: 81.10, y: 59.09 },
    'right-mid-link-a': { x: 68.18, y: 50.58 },
    'seat-front-desk-stand': { x: 53.35, y: 48.88 },
    'seat-lamp-left-stand': { x: 26.56, y: 52.28 },
    'seat-lamp-desk-stand': { x: 30.86, y: 45.48 },
    'seat-lamp-right-stand': { x: 45.69, y: 57.39 },
    'seat-middle-left-stand': { x: 53.35, y: 68.44 },
    'seat-lower-right-stand': { x: 54.31, y: 81.19 },
  }),
  'sports-center': Object.freeze({
    'dumbbell-aisle': { x: 15.55, y: 60.79 },
    'treadmill-aisle': { x: 35.17, y: 36.13 },
    'machine-aisle': { x: 72.01, y: 31.88 },
  }),
  auditorium: Object.freeze({
    'lower-aisle': { x: 67, y: 89 },
    'lower-row': { x: 69.5, y: 84.5 },
    'lower-left-aisle': { x: 13.64, y: 86.29 },
    'middle-aisle': { x: 67, y: 70 },
    'middle-row': { x: 68.5, y: 67.5 },
    'middle-left-aisle': { x: 9.81, y: 63.34 },
    'upper-aisle': { x: 67, y: 53 },
    'upper-row': { x: 66, y: 50.5 },
    'upper-left-aisle': { x: 10.29, y: 50.59 },
    'rear-aisle': { x: 51.91, y: 33.58 },
    'stage-steps': { x: 56.22, y: 32.5 },
  }),
  'learning-lab': Object.freeze({
    entrance: { x: 36, y: 85 },
    'front-left': { x: 36, y: 83 },
    'back-aisle': { x: 52.87, y: 43.78 },
    'activity-table': { x: 54, y: 44.63 },
  }),
})

export function resolveRoomNodes(roomId: ImageRoomId, nodes: readonly NavigationNode[]): readonly NavigationNode[] {
  const overrides = OVERRIDES[roomId]
  if (!overrides) return nodes
  return Object.freeze(nodes.map((node) => {
    const override = overrides[node.id]
    return override
      ? Object.freeze({ ...node, ...override, z: override.z ?? node.z })
      : node
  }))
}
