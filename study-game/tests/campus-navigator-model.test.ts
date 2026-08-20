import { describe, expect, it } from 'vitest'

import { CAMPUS_ROOM_CARDS, filterCampusRooms } from '../src/ui/CampusNavigatorModel'

describe('campus navigator model', () => {
  it('keeps the five curated playable campus rooms', () => {
    expect(CAMPUS_ROOM_CARDS.map((room) => room.id)).toEqual(['library', 'chim-alan', 'sports-center', 'auditorium', 'learning-lab'])
  })

  it('filters by Turkish-aware search and category', () => {
    expect(filterCampusRooms('çim').map((room) => room.id)).toEqual(['chim-alan'])
    expect(filterCampusRooms('', 'study').map((room) => room.id)).toEqual(['library', 'learning-lab'])
    expect(filterCampusRooms('events')).toHaveLength(1)
  })
})
