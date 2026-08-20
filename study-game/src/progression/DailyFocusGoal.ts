export const DEFAULT_DAILY_FOCUS_TARGET_MINUTES = 25

export type DailyFocusGoalInput = Readonly<{
  todaySeconds: number
  activeSeconds: number
  running: boolean
  counting: boolean
  targetMinutes?: number
}>

export type DailyFocusGoal = Readonly<{
  targetMinutes: number
  verifiedMinutes: number
  remainingMinutes: number
  progressPercent: number
  complete: boolean
  kicker: string
  title: string
  copy: string
  meterLabel: string
  rewardLabel: string
}>

const safeSeconds = (value: number): number => Number.isFinite(value) && value > 0 ? value : 0

export function buildDailyFocusGoal(input: DailyFocusGoalInput): DailyFocusGoal {
  const targetMinutes = Number.isFinite(input.targetMinutes) && input.targetMinutes! > 0
    ? Math.floor(input.targetMinutes!)
    : DEFAULT_DAILY_FOCUS_TARGET_MINUTES
  const effectiveSeconds = safeSeconds(input.todaySeconds) + (input.running ? safeSeconds(input.activeSeconds) : 0)
  const verifiedMinutes = Math.min(targetMinutes, Math.floor(effectiveSeconds / 60))
  const remainingMinutes = Math.max(0, targetMinutes - verifiedMinutes)
  const complete = remainingMinutes === 0
  const progressPercent = Math.round((verifiedMinutes / targetMinutes) * 100)

  if (complete) {
    return Object.freeze({
      targetMinutes, verifiedMinutes, remainingMinutes, progressPercent, complete,
      kicker: 'DAILY FOCUS COMPLETE',
      title: `Today's ${targetMinutes}-minute goal is complete`,
      copy: 'Gold is capped at 25 per day across Study and Pomodoro. Your focus time still builds your record.',
      meterLabel: `${verifiedMinutes}/${targetMinutes} MIN`,
      rewardLabel: 'GOAL COMPLETE',
    })
  }

  const title = input.counting
    ? `${remainingMinutes} verified min to today's goal`
    : input.running
      ? 'Return to continue today\'s goal'
      : verifiedMinutes > 0
        ? 'Continue your daily focus goal'
        : 'Earn Gold with verified focus'

  return Object.freeze({
    targetMinutes, verifiedMinutes, remainingMinutes, progressPercent, complete,
    kicker: input.counting ? 'VERIFIED FOCUS ACTIVE' : input.running ? 'FOCUS PAUSED' : 'DAILY FOCUS GOAL',
    title,
    copy: input.counting
      ? 'Stay seated with this tab visible. Bank 1 Gold per verified minute when the session ends.'
      : input.running
        ? 'Focus time only counts while the game is visible and active.'
        : 'Sit in any study seat. Earn up to 25 Gold per day across Study and Pomodoro.',
    meterLabel: `${verifiedMinutes}/${targetMinutes} MIN`,
    rewardLabel: 'UP TO 25 GOLD',
  })
}
