const STORAGE_KEY = 'radiotedu.study.ignored-players.v1'
const MAX_IGNORED_PLAYERS = 200
const SAFE_USER_ID = /^[a-zA-Z0-9:_-]{1,96}$/

export type SafetyStorage = Pick<Storage, 'getItem' | 'setItem'>

export class IgnoredPlayerStore {
  readonly #storage: SafetyStorage
  readonly #ignored = new Set<string>()

  constructor(storage: SafetyStorage) {
    this.#storage = storage
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]')
      if (Array.isArray(parsed)) {
        for (const value of parsed.slice(0, MAX_IGNORED_PLAYERS)) {
          if (typeof value === 'string' && SAFE_USER_ID.test(value)) this.#ignored.add(value)
        }
      }
    } catch {
      this.#ignored.clear()
    }
  }

  has(userId: string): boolean {
    return this.#ignored.has(userId)
  }

  toggle(userId: string): boolean {
    if (!SAFE_USER_ID.test(userId)) return false
    if (this.#ignored.has(userId)) this.#ignored.delete(userId)
    else if (this.#ignored.size < MAX_IGNORED_PLAYERS) this.#ignored.add(userId)
    this.#persist()
    return this.#ignored.has(userId)
  }

  filter<T extends { userId: string }>(items: readonly T[]): readonly T[] {
    return items.filter((item) => !this.#ignored.has(item.userId))
  }

  values(): readonly string[] {
    return Object.freeze([...this.#ignored])
  }

  #persist(): void {
    this.#storage.setItem(STORAGE_KEY, JSON.stringify([...this.#ignored]))
  }
}
