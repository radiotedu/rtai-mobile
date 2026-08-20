import type { StudyRoomId } from '../adapters/StudyAdapter'

export type StudyPathInput = Readonly<{
  todaySeconds: number
  totalSeconds: number
  visitedRooms: ReadonlySet<StudyRoomId>
  socialActions: number
  seatedNow: boolean
}>

export type StudyPathGoal = Readonly<{
  id: 'take-a-seat' | 'daily-focus' | 'campus-explorer' | 'study-together'
  title: string
  description: string
  progress: number
  target: number
  unit: 'steps' | 'minutes' | 'rooms' | 'actions'
  complete: boolean
}>

const clampProgress = (value: number, target: number): number =>
  Math.min(target, Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)))

export function buildStudyPath(input: StudyPathInput): readonly StudyPathGoal[] {
  const focusMinutes = Math.floor(Math.max(0, input.todaySeconds) / 60)
  const hasStudied = input.seatedNow || input.totalSeconds > 0
  const goals: StudyPathGoal[] = [
    {
      id: 'take-a-seat',
      title: 'Take a Study Seat',
      description: 'Sit in any available study seat and begin a verified focus session.',
      progress: hasStudied ? 1 : 0,
      target: 1,
      unit: 'steps',
      complete: hasStudied,
    },
    {
      id: 'daily-focus',
      title: 'Daily Focus Goal',
      description: 'Complete 25 verified focus minutes in any study room.',
      progress: clampProgress(focusMinutes, 25),
      target: 25,
      unit: 'minutes',
      complete: focusMinutes >= 25,
    },
    {
      id: 'campus-explorer',
      title: 'Explore the Campus',
      description: 'Visit every available TEDU place in this session.',
      progress: clampProgress(input.visitedRooms.size, 5),
      target: 5,
      unit: 'rooms',
      complete: input.visitedRooms.size >= 5,
    },
    {
      id: 'study-together',
      title: 'Study Together',
      description: 'Wave or send a friendly room reaction.',
      progress: clampProgress(input.socialActions, 1),
      target: 1,
      unit: 'actions',
      complete: input.socialActions >= 1,
    },
  ]
  return Object.freeze(goals.map((goal) => Object.freeze(goal)))
}
