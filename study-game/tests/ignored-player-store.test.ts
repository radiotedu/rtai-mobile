import { describe, expect, it } from 'vitest'

import { IgnoredPlayerStore } from '../src/safety/IgnoredPlayerStore'

const memoryStorage = (initial: string | null = null) => {
  let value = initial
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next },
  }
}

describe('ignored player store', () => {
  it('persists valid ignored IDs and filters their content', () => {
    const storage = memoryStorage()
    const store = new IgnoredPlayerStore(storage)
    expect(store.toggle('student-2')).toBe(true)
    expect(store.filter([{ userId: 'student-1' }, { userId: 'student-2' }])).toEqual([{ userId: 'student-1' }])
    expect(new IgnoredPlayerStore(storage).has('student-2')).toBe(true)
  })

  it('rejects unsafe identifiers and malformed storage', () => {
    const store = new IgnoredPlayerStore(memoryStorage('{broken'))
    expect(store.toggle('<script>')).toBe(false)
    expect(store.values()).toEqual([])
  })
})
