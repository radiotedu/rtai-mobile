export type StudyGearKind = 'laptop' | 'pet'

export type StudyGearItem = Readonly<{
  id: string
  kind: StudyGearKind
  name: string
  description: string
  price: number
  image: string
}>

export const STUDY_GEAR: readonly StudyGearItem[] = Object.freeze([
  { id: 'laptop-campus', kind: 'laptop', name: 'Campus Laptop', description: 'A reliable starter for daily focus.', price: 0, image: 'assets/study-gear/items/laptop-campus.png' },
  { id: 'laptop-pro', kind: 'laptop', name: 'StudyBook Pro', description: 'A slim upgrade with a study dashboard.', price: 120, image: 'assets/study-gear/items/laptop-pro.png' },
  { id: 'laptop-gold', kind: 'laptop', name: 'Gold Scholar', description: 'The collectible gold campus edition.', price: 220, image: 'assets/study-gear/items/laptop-gold.png' },
  { id: 'pet-tarcin', kind: 'pet', name: 'Tarçın', description: 'A tiny ginger study companion.', price: 0, image: 'assets/study-gear/items/pet-tarcin.png' },
  { id: 'pet-benek', kind: 'pet', name: 'Benek', description: 'A curious spotted campus cat.', price: 140, image: 'assets/study-gear/items/pet-benek.png' },
  { id: 'pet-komur', kind: 'pet', name: 'Kömür', description: 'A calm dark-coated companion.', price: 180, image: 'assets/study-gear/items/pet-komur.png' },
])

export type StudyGearSnapshot = Readonly<{
  gold: number
  owned: readonly string[]
  equipped: Readonly<Record<StudyGearKind, string | null>>
}>

const STORAGE_KEY = 'radiotedu-study-gear-v1'
type Listener = (snapshot: StudyGearSnapshot) => void

export type StudyGearInitialization = Readonly<{
  authoritative?: boolean
  ownedItemIds?: readonly string[]
  equippedItemIds?: readonly string[]
}>

class StudyGearStore {
  #gold = 0
  #owned = new Set<string>(['laptop-campus', 'pet-tarcin'])
  #equipped: Record<StudyGearKind, string | null> = { laptop: 'laptop-campus', pet: 'pet-tarcin' }
  #listeners = new Set<Listener>()
  #authoritative = false

  initialize(gold: number, options: StudyGearInitialization = {}): void {
    this.#authoritative = options.authoritative === true
    this.#gold = Math.max(0, Math.floor(gold))
    this.#owned = new Set(['laptop-campus', 'pet-tarcin'])
    this.#equipped = { laptop: 'laptop-campus', pet: 'pet-tarcin' }
    if (this.#authoritative) {
      for (const id of options.ownedItemIds ?? []) {
        if (STUDY_GEAR.some((item) => item.id === id)) this.#owned.add(id)
      }
      for (const id of options.equippedItemIds ?? []) {
        const item = STUDY_GEAR.find((candidate) => candidate.id === id)
        if (item && this.#owned.has(id)) this.#equipped[item.kind] = id
      }
      this.#emit()
      return
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const saved = JSON.parse(raw || 'null') as Partial<StudyGearSnapshot> | null
      if (saved?.owned) this.#owned = new Set([...saved.owned, 'laptop-campus', 'pet-tarcin'])
      if (saved?.equipped) this.#equipped = { ...this.#equipped, ...saved.equipped }
      if (Number.isFinite(saved?.gold)) this.#gold = Math.max(0, Math.floor(saved!.gold!))
    } catch {}
    this.#emit()
  }

  synchronizeGold(gold: number): void {
    if (!Number.isFinite(gold) || gold < 0) return
    const next = Math.floor(gold)
    if (next === this.#gold) return
    this.#gold = next
    this.#emit()
  }

  recordAuthoritativePurchase(id: string, gold: number): boolean {
    if (!this.#authoritative || !STUDY_GEAR.some((item) => item.id === id)) return false
    if (!Number.isInteger(gold) || gold < 0) return false
    this.#gold = gold
    this.#owned.add(id)
    this.#emit()
    return true
  }

  recordAuthoritativeEquip(id: string): boolean {
    const item = STUDY_GEAR.find((candidate) => candidate.id === id)
    if (!this.#authoritative || !item || !this.#owned.has(id)) return false
    this.#equipped[item.kind] = id
    this.#emit()
    return true
  }

  snapshot(): StudyGearSnapshot {
    return Object.freeze({ gold: this.#gold, owned: Object.freeze([...this.#owned]), equipped: Object.freeze({ ...this.#equipped }) })
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener)
    listener(this.snapshot())
    return () => this.#listeners.delete(listener)
  }

  activate(id: string): { ok: boolean; message: string } {
    const item = STUDY_GEAR.find((candidate) => candidate.id === id)
    if (!item) return { ok: false, message: 'That item is unavailable.' }
    if (this.#authoritative) return { ok: false, message: 'This item must be changed by the Study server.' }
    if (!this.#owned.has(id)) {
      if (this.#gold < item.price) return { ok: false, message: 'You need more Gold for that item.' }
      this.#gold -= item.price
      this.#owned.add(id)
    }
    this.#equipped[item.kind] = this.#equipped[item.kind] === id ? null : id
    this.#emit()
    return { ok: true, message: this.#equipped[item.kind] === id ? `${item.name} equipped.` : `${item.name} put away.` }
  }

  #emit(): void {
    const snapshot = this.snapshot()
    if (!this.#authoritative) {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)) } catch {}
    }
    for (const listener of this.#listeners) listener(snapshot)
    window.dispatchEvent(new CustomEvent('radiotedu:study-gear-changed', { detail: snapshot }))
  }
}

export const studyGear = new StudyGearStore()
