import { describe, expect, it } from 'vitest'

import { calculateOverviewZoom, calculatePlayableZoom, cameraFramingMode } from '../src/game/CameraFraming'

describe('calculateOverviewZoom', () => {
  it('fits the complete portrait room inside a desktop viewport', () => {
    const zoom = calculateOverviewZoom(
      { width: 1440, height: 772 },
      { width: 941, height: 1672 },
    )

    expect(zoom).toBeCloseTo(772 / 1672)
    expect(941 * zoom).toBeLessThanOrEqual(1440)
    expect(1672 * zoom).toBeLessThanOrEqual(772)
  })

  it('fits the complete room inside a portrait mobile viewport', () => {
    const zoom = calculateOverviewZoom(
      { width: 390, height: 664 },
      { width: 941, height: 1672 },
    )

    expect(941 * zoom).toBeLessThanOrEqual(390)
    expect(1672 * zoom).toBeLessThanOrEqual(664)
  })
})

describe('calculatePlayableZoom', () => {
  it('fills a 16:9 desktop stage without stretching the room art', () => {
    const zoom = calculatePlayableZoom(
      { width: 1600, height: 900 },
      { width: 941, height: 760 },
    )

    expect(zoom).toBeCloseTo(1600 / 941)
    expect(941 * zoom).toBeGreaterThanOrEqual(1600)
    expect(760 * zoom).toBeGreaterThanOrEqual(900)
  })
})

describe('cameraFramingMode', () => {
  it('keeps a readable overview on a normal desktop stage', () => {
    expect(cameraFramingMode(
      { width: 1425, height: 900 },
      { width: 1672, height: 941 },
    )).toBe('overview')
  })

  it('follows the actor when a very short wide stage would make seated avatars tiny', () => {
    expect(cameraFramingMode(
      { width: 1425, height: 407 },
      { width: 1672, height: 941 },
    )).toBe('follow')
  })

  it('follows the actor on a phone viewport', () => {
    expect(cameraFramingMode(
      { width: 390, height: 844 },
      { width: 1672, height: 941 },
    )).toBe('follow')
  })
})
