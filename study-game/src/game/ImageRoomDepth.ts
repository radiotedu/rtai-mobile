type ImageRoomDepthPoint = Readonly<{ y: number; z?: number }>

export function imageRoomActorDepth(point: ImageRoomDepthPoint, offset = 10): number {
  // The room artwork and actor anchor are already projected into screen-space.
  // Adding z here applies elevation a second time and pulls an elevated actor
  // in front of the bench face that should cover their lower body. Keep z for
  // routing and stair interpolation; painter order follows the projected feet Y.
  return point.y * 100 + offset
}
