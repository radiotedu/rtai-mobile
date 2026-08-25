export type StudyRadioChannelId = 'main' | 'spark' | 'rock'

export type StudyRadioChannel = Readonly<{
  id: StudyRadioChannelId
  title: string
  streamUrl: string
}>

export const STUDY_RADIO_CHANNELS: Readonly<Record<StudyRadioChannelId, StudyRadioChannel>> = Object.freeze({
  main: Object.freeze({
    id: 'main',
    title: 'Main Channel',
    streamUrl: 'https://stream.radiotedu.com/radio',
  }),
  spark: Object.freeze({
    id: 'spark',
    title: 'Energize Radio',
    streamUrl: 'https://stream.radiotedu.com/energize',
  }),
  rock: Object.freeze({
    id: 'rock',
    title: 'Rock Radio',
    streamUrl: 'https://stream.radiotedu.com/rock',
  }),
})

export function resolveStudyRadioChannel(value: unknown): StudyRadioChannel | null {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STUDY_RADIO_CHANNELS, value)
    ? STUDY_RADIO_CHANNELS[value as StudyRadioChannelId]
    : null
}
