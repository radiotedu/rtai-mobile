import { describe, expect, it } from 'vitest'
import { resolveStudyRadioChannel, STUDY_RADIO_CHANNELS } from '../src/radio/StudyRadioChannels'

describe('Study roadside radios', () => {
  it('uses the currently live stable stream mounts', () => {
    expect(STUDY_RADIO_CHANNELS.main.streamUrl).toBe('https://stream.radiotedu.com/radio')
    expect(STUDY_RADIO_CHANNELS.spark.streamUrl).toBe('https://stream.radiotedu.com/energize')
    expect(STUDY_RADIO_CHANNELS.rock.streamUrl).toBe('https://stream.radiotedu.com/rock')
  })

  it('does not resolve arbitrary URLs or prototype keys', () => {
    expect(resolveStudyRadioChannel('spark')).toEqual(STUDY_RADIO_CHANNELS.spark)
    expect(resolveStudyRadioChannel('https://attacker.invalid/stream')).toBeNull()
    expect(resolveStudyRadioChannel('__proto__')).toBeNull()
    expect(resolveStudyRadioChannel(null)).toBeNull()
  })
})
