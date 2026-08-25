export type WorldPoint = Readonly<{ x: number; y: number }>

export type NavigationLayerGeometry = Readonly<{
  z: number
  walkable: readonly (readonly WorldPoint[])[]
}>

export type NavigationFieldGeometry = Readonly<{
  layers: readonly NavigationLayerGeometry[]
  obstacles: readonly (readonly WorldPoint[])[]
}>

type GridCell = Readonly<{ x: number; y: number }>

type GridLayer = Readonly<{
  z: number
  cells: ReadonlySet<number>
}>

const SQRT_TWO = Math.SQRT2

function pointOnSegment(point: WorldPoint, from: WorldPoint, to: WorldPoint): boolean {
  const cross = ((point.y - from.y) * (to.x - from.x)) - ((point.x - from.x) * (to.y - from.y))
  if (Math.abs(cross) > 0.001) return false
  const dot = ((point.x - from.x) * (to.x - from.x)) + ((point.y - from.y) * (to.y - from.y))
  if (dot < 0) return false
  const lengthSquared = ((to.x - from.x) ** 2) + ((to.y - from.y) ** 2)
  return dot <= lengthSquared
}

export function pointInPolygon(point: WorldPoint, polygon: readonly WorldPoint[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index]!
    const prior = polygon[previous]!
    if (pointOnSegment(point, prior, current)) return true
    const intersects = (current.y > point.y) !== (prior.y > point.y)
      && point.x < (((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y)) + current.x
    if (intersects) inside = !inside
  }
  return inside
}

function distanceToSegment(point: WorldPoint, from: WorldPoint, to: WorldPoint): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - from.x, point.y - from.y)
  const amount = Math.max(0, Math.min(1, (((point.x - from.x) * dx) + ((point.y - from.y) * dy)) / lengthSquared))
  return Math.hypot(point.x - (from.x + amount * dx), point.y - (from.y + amount * dy))
}

export function distanceToPolygon(point: WorldPoint, polygon: readonly WorldPoint[]): number {
  let closest = Number.POSITIVE_INFINITY
  for (let index = 0; index < polygon.length; index += 1) {
    closest = Math.min(closest, distanceToSegment(point, polygon[index]!, polygon[(index + 1) % polygon.length]!))
  }
  return closest
}

class MinHeap {
  readonly #items: Array<{ id: number; score: number }> = []

  get size(): number { return this.#items.length }

  push(id: number, score: number): void {
    const item = { id, score }
    this.#items.push(item)
    let index = this.#items.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.#items[parent]!.score <= score) break
      this.#items[index] = this.#items[parent]!
      index = parent
    }
    this.#items[index] = item
  }

  pop(): { id: number; score: number } | undefined {
    const root = this.#items[0]
    const tail = this.#items.pop()
    if (!root || !tail || this.#items.length === 0) return root
    let index = 0
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      if (left >= this.#items.length) break
      const child = right < this.#items.length && this.#items[right]!.score < this.#items[left]!.score ? right : left
      if (this.#items[child]!.score >= tail.score) break
      this.#items[index] = this.#items[child]!
      index = child
    }
    this.#items[index] = tail
    return root
  }
}

export class RoomNavigationField {
  readonly cellSize: number
  readonly clearance: number
  readonly width: number
  readonly height: number
  readonly #columns: number
  readonly #rows: number
  readonly #geometry: NavigationFieldGeometry
  readonly #layers: ReadonlyMap<number, GridLayer>

  constructor(input: Readonly<{
    width: number
    height: number
    geometry: NavigationFieldGeometry
    cellSize?: number
    clearance?: number
  }>) {
    this.width = input.width
    this.height = input.height
    this.cellSize = input.cellSize ?? 8
    this.clearance = input.clearance ?? 18
    this.#columns = Math.ceil(this.width / this.cellSize)
    this.#rows = Math.ceil(this.height / this.cellSize)
    this.#geometry = input.geometry
    this.#layers = new Map(input.geometry.layers.map((layer) => {
      const cells = new Set<number>()
      for (let y = 0; y < this.#rows; y += 1) {
        for (let x = 0; x < this.#columns; x += 1) {
          const point = this.#cellPoint({ x, y })
          if (this.#pointIsWalkable(point, layer.z)) cells.add(this.#id({ x, y }))
        }
      }
      return [layer.z, Object.freeze({ z: layer.z, cells })]
    }))
  }

  layerIds(): readonly number[] {
    return [...this.#layers.keys()].sort((left, right) => left - right)
  }

  samples(z = 0, strideCells = 10): readonly WorldPoint[] {
    const layer = this.#layers.get(z)
    if (!layer) return []
    return [...layer.cells]
      .map((id) => this.#fromId(id))
      .filter((cell) => cell.x % strideCells === 0 && cell.y % strideCells === 0)
      .map((cell) => this.#cellPoint(cell))
  }

  layerAt(point: WorldPoint, preferredZ = 0): number | null {
    // Height-mapped isometric clients resolve overlapping screen projections
    // from the highest valid floor down. Preferring the current layer made a
    // click on an elevated terrace resolve to the ground polygon underneath.
    const candidates = this.layerIds().filter((z) => this.isWalkable(point, z))
    if (candidates.length === 0) return null
    return candidates.at(-1) ?? (this.isWalkable(point, preferredZ) ? preferredZ : null)
  }

  isWalkable(point: WorldPoint, z = 0): boolean {
    const cell = this.#cell(point)
    return this.#layers.get(z)?.cells.has(this.#id(cell)) === true && this.#pointIsWalkable(point, z)
  }

  nearestWalkable(point: WorldPoint, z = 0, maxDistance = 120): WorldPoint | null {
    if (this.isWalkable(point, z)) return { ...point }
    const center = this.#cell(point)
    const radius = Math.ceil(maxDistance / this.cellSize)
    let best: { point: WorldPoint; distance: number } | null = null
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const cell = { x: center.x + dx, y: center.y + dy }
        if (!this.#inBounds(cell) || !this.#layers.get(z)?.cells.has(this.#id(cell))) continue
        const candidate = this.#cellPoint(cell)
        const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y)
        if (distance <= maxDistance && (!best || distance < best.distance)) best = { point: candidate, distance }
      }
    }
    return best?.point ?? null
  }

  nearestReachable(start: WorldPoint, target: WorldPoint, z = 0, maxDistance = 220): WorldPoint | null {
    const resolvedStart = this.nearestWalkable(start, z, maxDistance)
    const layer = this.#layers.get(z)
    if (!resolvedStart || !layer) return null
    const queue: GridCell[] = [this.#cell(resolvedStart)]
    const visited = new Set<number>([this.#id(queue[0]!)])
    let best: { point: WorldPoint; distance: number } | null = null
    for (let index = 0; index < queue.length; index += 1) {
      const cell = queue[index]!
      const point = this.#cellPoint(cell)
      const distance = Math.hypot(point.x - target.x, point.y - target.y)
      if (distance <= maxDistance && (!best || distance < best.distance)) best = { point, distance }
      for (const neighbor of this.#neighbors(cell, z)) {
        const id = this.#id(neighbor.cell)
        if (visited.has(id)) continue
        visited.add(id)
        queue.push(neighbor.cell)
      }
    }
    return best?.point ?? null
  }

  segmentIsWalkable(from: WorldPoint, to: WorldPoint, z = 0): boolean {
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const steps = Math.max(1, Math.ceil(distance / (this.cellSize / 2)))
    for (let index = 0; index <= steps; index += 1) {
      const amount = index / steps
      if (!this.isWalkable({
        x: from.x + ((to.x - from.x) * amount),
        y: from.y + ((to.y - from.y) * amount),
      }, z)) return false
    }
    return true
  }

  findPath(start: WorldPoint, goal: WorldPoint, z = 0): readonly WorldPoint[] {
    const resolvedStart = this.nearestWalkable(start, z)
    if (!resolvedStart || !this.isWalkable(goal, z)) return []
    if (this.segmentIsWalkable(resolvedStart, goal, z)) return [resolvedStart, { ...goal }]

    const startCell = this.#cell(resolvedStart)
    const goalCell = this.#cell(goal)
    const startId = this.#id(startCell)
    const goalId = this.#id(goalCell)
    const open = new MinHeap()
    const cameFrom = new Map<number, number>()
    const cost = new Map<number, number>([[startId, 0]])
    open.push(startId, this.#heuristic(startCell, goalCell))

    while (open.size > 0) {
      const currentEntry = open.pop()!
      const current = this.#fromId(currentEntry.id)
      if (currentEntry.id === goalId) {
        const cells = [goalId]
        while (cameFrom.has(cells[0]!)) cells.unshift(cameFrom.get(cells[0]!)!)
        const raw = cells.map((id) => this.#cellPoint(this.#fromId(id)))
        raw[0] = resolvedStart
        raw[raw.length - 1] = { ...goal }
        return this.#smooth(raw, z)
      }

      for (const neighbor of this.#neighbors(current, z)) {
        const neighborId = this.#id(neighbor.cell)
        const nextCost = (cost.get(currentEntry.id) ?? Number.POSITIVE_INFINITY) + neighbor.cost
        if (nextCost >= (cost.get(neighborId) ?? Number.POSITIVE_INFINITY)) continue
        cameFrom.set(neighborId, currentEntry.id)
        cost.set(neighborId, nextCost)
        open.push(neighborId, nextCost + this.#heuristic(neighbor.cell, goalCell))
      }
    }
    return []
  }

  #pointIsWalkable(point: WorldPoint, z: number): boolean {
    if (point.x < 0 || point.y < 0 || point.x > this.width || point.y > this.height) return false
    const layer = this.#geometry.layers.find((candidate) => candidate.z === z)
    if (!layer) return false
    const floors = layer.walkable.filter((polygon) => pointInPolygon(point, polygon))
    if (floors.length === 0) return false
    // Shared polygon seams are internal floor, not a wall. Treat an overlap as
    // connected space; applying edge clearance to the first polygon alone
    // split Çim Alan's terrace from its courtyard despite a broad shared area.
    if (floors.length === 1 && distanceToPolygon(point, floors[0]!) < this.clearance * 0.45) return false
    return !this.#geometry.obstacles.some((polygon) => (
      pointInPolygon(point, polygon) || distanceToPolygon(point, polygon) < this.clearance
    ))
  }

  #smooth(points: readonly WorldPoint[], z: number): readonly WorldPoint[] {
    if (points.length < 3) return points
    const result: WorldPoint[] = [points[0]!]
    let anchor = 0
    while (anchor < points.length - 1) {
      let next = points.length - 1
      while (next > anchor + 1 && !this.segmentIsWalkable(points[anchor]!, points[next]!, z)) next -= 1
      result.push(points[next]!)
      anchor = next
    }
    return result
  }

  #neighbors(cell: GridCell, z: number): readonly { cell: GridCell; cost: number }[] {
    const layer = this.#layers.get(z)
    if (!layer) return []
    const result: Array<{ cell: GridCell; cost: number }> = []
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const candidate = { x: cell.x + dx, y: cell.y + dy }
      if (!this.#inBounds(candidate) || !layer.cells.has(this.#id(candidate))) continue
      if (dx !== 0 && dy !== 0) {
        if (!layer.cells.has(this.#id({ x: cell.x + dx, y: cell.y }))) continue
        if (!layer.cells.has(this.#id({ x: cell.x, y: cell.y + dy }))) continue
      }
      result.push({ cell: candidate, cost: dx !== 0 && dy !== 0 ? SQRT_TWO : 1 })
    }
    return result
  }

  #heuristic(from: GridCell, to: GridCell): number {
    const dx = Math.abs(to.x - from.x)
    const dy = Math.abs(to.y - from.y)
    return Math.max(dx, dy) + ((SQRT_TWO - 1) * Math.min(dx, dy))
  }

  #cell(point: WorldPoint): GridCell {
    return {
      x: Math.max(0, Math.min(this.#columns - 1, Math.floor(point.x / this.cellSize))),
      y: Math.max(0, Math.min(this.#rows - 1, Math.floor(point.y / this.cellSize))),
    }
  }

  #cellPoint(cell: GridCell): WorldPoint {
    return {
      x: Math.min(this.width - 0.001, (cell.x + 0.5) * this.cellSize),
      y: Math.min(this.height - 0.001, (cell.y + 0.5) * this.cellSize),
    }
  }

  #id(cell: GridCell): number { return cell.y * this.#columns + cell.x }
  #fromId(id: number): GridCell { return { x: id % this.#columns, y: Math.floor(id / this.#columns) } }
  #inBounds(cell: GridCell): boolean { return cell.x >= 0 && cell.y >= 0 && cell.x < this.#columns && cell.y < this.#rows }
}
