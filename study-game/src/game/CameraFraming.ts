export interface CameraSize {
  width: number
  height: number
}

export type CameraFramingMode = 'overview' | 'follow'

const DESKTOP_OVERVIEW_ASPECT_RATIO = 1.45
const MIN_OVERVIEW_ZOOM = 0.5

export function calculateOverviewZoom(viewport: CameraSize, room: CameraSize): number {
  if (viewport.width <= 0 || viewport.height <= 0 || room.width <= 0 || room.height <= 0) return 1
  return Math.min(viewport.width / room.width, viewport.height / room.height)
}

export function calculatePlayableZoom(viewport: CameraSize, room: CameraSize): number {
  if (viewport.width <= 0 || viewport.height <= 0 || room.width <= 0 || room.height <= 0) return 1
  return Math.max(viewport.width / room.width, viewport.height / room.height)
}

export function cameraFramingMode(viewport: CameraSize, room: CameraSize): CameraFramingMode {
  if (viewport.width <= 0 || viewport.height <= 0 || room.width <= 0 || room.height <= 0) return 'follow'
  const wideStage = viewport.width / viewport.height >= DESKTOP_OVERVIEW_ASPECT_RATIO
  const overviewKeepsActorsReadable = calculateOverviewZoom(viewport, room) >= MIN_OVERVIEW_ZOOM
  return wideStage && overviewKeepsActorsReadable ? 'overview' : 'follow'
}
