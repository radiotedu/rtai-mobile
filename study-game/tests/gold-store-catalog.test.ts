import { describe, expect, it } from 'vitest'

import { GOLD_STORE_ITEMS } from '../src/inventory/GoldStoreCatalog'

describe('Gold store catalog', () => {
  it('offers only server-backed wearables with complete Study artwork', () => {
    expect(GOLD_STORE_ITEMS.map((item) => item.id)).toEqual(['beanie', 'boots', 'black-cargos', 'radiotedu-tee', 'varsity-jacket'])
    expect(GOLD_STORE_ITEMS.every((item) => item.price > 0)).toBe(true)
    expect(GOLD_STORE_ITEMS.some((item) => item.id.startsWith('laptop-') || item.id.startsWith('pet-'))).toBe(false)
  })
})
