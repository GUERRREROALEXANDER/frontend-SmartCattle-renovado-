import { describe, expect, it } from 'vitest'
import { bogotaHour, daylightAtHour, daylightFor, formatBogotaTime, phaseAt } from './daylight'

describe('the farm clock', () => {
  it('is five hours behind UTC all year', () => {
    expect(bogotaHour(new Date('2026-01-15T17:30:00Z'))).toBeCloseTo(12.5)
    expect(bogotaHour(new Date('2026-07-15T17:30:00Z'))).toBeCloseTo(12.5)
  })

  it('wraps past midnight instead of going negative', () => {
    expect(bogotaHour(new Date('2026-11-15T03:00:00Z'))).toBeCloseTo(22)
  })

  it('writes the hour the way people at the farm read it', () => {
    expect(formatBogotaTime(0.25)).toBe('12:15 a. m.')
    expect(formatBogotaTime(12)).toBe('12:00 p. m.')
    expect(formatBogotaTime(18.75)).toBe('6:45 p. m.')
  })
})

describe('the phases of the day', () => {
  it.each([
    [6, 'day'], [12, 'day'], [17.49, 'day'],
    [17.5, 'dusk'], [18.74, 'dusk'],
    [18.75, 'night'], [23, 'night'], [0, 'night'], [5.99, 'night'],
  ] as const)('at %s h it is %s', (hour, phase) => {
    expect(phaseAt(hour)).toBe(phase)
  })
})

describe('the light of the scene', () => {
  it('turns the lamps and the stars on only at night', () => {
    expect(daylightAtHour(12)).toMatchObject({ phase: 'day', lamps: false, stars: 0 })
    expect(daylightAtHour(22)).toMatchObject({ phase: 'night', lamps: true, stars: 1 })
  })

  it('is brightest at midday and never fully dark', () => {
    const noon = daylightAtHour(12)
    const night = daylightAtHour(1)
    expect(noon.lightIntensity).toBeGreaterThan(night.lightIntensity)
    // A moonlit farm must stay readable: the herd is still being watched.
    expect(night.lightIntensity).toBeGreaterThan(0.5)
  })

  it('blends between phases instead of jumping', () => {
    const before = daylightAtHour(18.4)
    const after = daylightAtHour(18.45)
    expect(Math.abs(before.lightIntensity - after.lightIntensity)).toBeLessThan(0.3)
    expect(before.stars).toBeGreaterThan(0)
    expect(before.stars).toBeLessThan(1)
  })

  it('keeps the light above the horizon at every hour', () => {
    for (let hour = 0; hour < 24; hour += 0.5) {
      expect(daylightAtHour(hour).lightDirection.y).toBeGreaterThan(0.1)
    }
  })

  it('pins a fixed phase whatever the clock says', () => {
    const midnight = new Date('2026-11-15T05:00:00Z')
    expect(daylightFor('day', midnight).phase).toBe('day')
    expect(daylightFor('dusk', midnight).phase).toBe('dusk')
    expect(daylightFor('auto', midnight).phase).toBe('night')
  })
})
