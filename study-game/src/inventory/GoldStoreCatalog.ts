import type { WardrobeSlot } from './WearableCatalog'

export type GoldStoreItem = Readonly<{
  id: string
  slot: WardrobeSlot
  name: string
  description: string
  price: number
  rarity: 'COMMON' | 'RARE'
  swatch: string
}>

// Mirrors production avatar items that have complete movement and sitting art.
export const GOLD_STORE_ITEMS: readonly GoldStoreItem[] = Object.freeze([
  { id: 'beanie', slot: 'hat', name: 'Campus Beanie', description: 'A relaxed knit layer for late study sessions.', price: 35, rarity: 'COMMON', swatch: 'swatch-plum' },
  { id: 'boots', slot: 'shoes', name: 'Campus Boots', description: 'A durable dark pair for every room on campus.', price: 50, rarity: 'COMMON', swatch: 'swatch-black' },
  { id: 'black-cargos', slot: 'bottom', name: 'Black Cargos', description: 'A clean utility fit built for everyday movement.', price: 60, rarity: 'COMMON', swatch: 'swatch-black' },
  { id: 'radiotedu-tee', slot: 'top', name: 'RadioTEDU Tee', description: 'A clean broadcast-red campus T-shirt with complete animated poses.', price: 45, rarity: 'COMMON', swatch: 'swatch-ivory-red' },
  { id: 'varsity-jacket', slot: 'top', name: 'Varsity Jacket', description: 'The premium RadioTEDU campus layer.', price: 80, rarity: 'RARE', swatch: 'swatch-red' },
])
