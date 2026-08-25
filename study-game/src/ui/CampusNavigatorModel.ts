import type { StudyRoomId } from '../adapters/StudyAdapter'

export type CampusRoomCategory = 'study' | 'social' | 'activity' | 'events'

export type CampusRoomCard = Readonly<{
  id: StudyRoomId
  title: string
  category: CampusRoomCategory
  description: string
  imageUrl: string
  accent: string
}>

export const CAMPUS_ROOM_CARDS: readonly CampusRoomCard[] = Object.freeze([
  Object.freeze({ id: 'library', title: 'Library', category: 'study', description: 'Quiet focus seats and study groups', imageUrl: 'assets/rooms/library-wide.png', accent: '#79d2ae' }),
  Object.freeze({ id: 'chim-alan', title: 'Çim Alan', category: 'social', description: 'Çim Amfi, campus restaurant and outdoor study', imageUrl: 'assets/rooms/chim-alan-wide-360-restaurant-r3.png', accent: '#91c865' }),
  Object.freeze({ id: 'sports-center', title: 'Sports Center', category: 'activity', description: 'Training, movement and team activities', imageUrl: 'assets/rooms/tedu-sports-center-wide.png', accent: '#78aee8' }),
  Object.freeze({ id: 'auditorium', title: 'Auditorium', category: 'events', description: 'Talks, broadcasts and campus events', imageUrl: 'assets/rooms/fatma-semih-akbil-auditorium-wide.png', accent: '#d48582' }),
  Object.freeze({ id: 'learning-lab', title: 'Learning Lab', category: 'study', description: 'Pedagogy consoles and collaborative laboratory desks', imageUrl: 'assets/rooms/tedu-pedagogy-learning-lab-wide-r2.png', accent: '#e3a665' }),
])

export function filterCampusRooms(
  query: string,
  category: CampusRoomCategory | 'all' = 'all',
): readonly CampusRoomCard[] {
  const normalized = query.trim().toLocaleLowerCase('tr-TR')
  return CAMPUS_ROOM_CARDS.filter((room) => {
    if (category !== 'all' && room.category !== category) return false
    if (!normalized) return true
    return `${room.title} ${room.description} ${room.category}`.toLocaleLowerCase('tr-TR').includes(normalized)
  })
}
