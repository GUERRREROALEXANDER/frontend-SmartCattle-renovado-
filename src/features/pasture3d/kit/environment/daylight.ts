import { useEffect, useMemo, useState } from 'react'
import { Color, Vector3 } from 'three'

/** The farm's clock: Colombia has no daylight saving, so it is always UTC-5. */
const BOGOTA_UTC_OFFSET_HOURS = -5

export type DayPhase = 'day' | 'dusk' | 'night'
export type DaylightMode = 'auto' | DayPhase

/** Everything the scene needs to light itself for one moment of the day. */
export interface Daylight {
  phase: DayPhase
  /** Decimal hour in America/Bogota, 0 to 24. */
  hour: number
  /** Direction towards the sun, or the moon at night. */
  lightDirection: Vector3
  lightColor: Color
  lightIntensity: number
  hemisphereSky: Color
  hemisphereGround: Color
  hemisphereIntensity: number
  zenith: Color
  horizon: Color
  /** Colour of the sun or moon disc and its glow. */
  disc: Color
  cloud: Color
  fog: Color
  /** 0 by day, 1 in full night. */
  stars: number
  environmentIntensity: number
  exposure: number
  /** Barn and camera lamps are on. */
  lamps: boolean
}

interface Look {
  lightColor: number; lightIntensity: number
  hemisphereSky: number; hemisphereGround: number; hemisphereIntensity: number
  zenith: number; zenithGain: number; horizon: number; horizonGain: number
  disc: number; cloud: number; cloudGain: number; fog: number
  stars: number; environmentIntensity: number; exposure: number
}

const DAY: Look = {
  lightColor: 0xfff1dc, lightIntensity: 3,
  hemisphereSky: 0xcfe3ff, hemisphereGround: 0x5a7a34, hemisphereIntensity: 0.45,
  zenith: 0x3f7fcf, zenithGain: 1.25, horizon: 0xd3e3ea, horizonGain: 1.3,
  disc: 0xffebc7, cloud: 0xffffff, cloudGain: 1.43, fog: 0xc9d6dc,
  stars: 0, environmentIntensity: 0.6, exposure: 1,
}

const GOLDEN: Look = {
  lightColor: 0xffb070, lightIntensity: 2.3,
  hemisphereSky: 0xf2c9a4, hemisphereGround: 0x4f5a2c, hemisphereIntensity: 0.42,
  zenith: 0x35508f, zenithGain: 1.05, horizon: 0xf5a45c, horizonGain: 1.35,
  disc: 0xffa55c, cloud: 0xffc9a0, cloudGain: 1.3, fog: 0xdcae86,
  stars: 0, environmentIntensity: 0.5, exposure: 1,
}

const NIGHT: Look = {
  lightColor: 0xa9bcff, lightIntensity: 1.25,
  hemisphereSky: 0x4a66a0, hemisphereGround: 0x14261c, hemisphereIntensity: 0.7,
  zenith: 0x071230, zenithGain: 1, horizon: 0x1c3260, horizonGain: 1,
  disc: 0xdfe8ff, cloud: 0x33466f, cloudGain: 1, fog: 0x10202f,
  stars: 1, environmentIntensity: 0.3, exposure: 1.4,
}

/** Hour, look. Between two keys the scene blends, so no change is ever a jump. */
const KEYS: readonly (readonly [number, Look])[] = [
  [0, NIGHT], [5.4, NIGHT], [6.1, GOLDEN], [7.2, DAY],
  [16.8, DAY], [17.5, DAY], [18.15, GOLDEN], [18.75, NIGHT], [24, NIGHT],
]

const FIXED_HOURS: Record<DayPhase, number> = { day: 10.5, dusk: 18.1, night: 22 }

export function bogotaHour(date: Date): number {
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  return (hours + BOGOTA_UTC_OFFSET_HOURS + 24) % 24
}

export function phaseAt(hour: number): DayPhase {
  if (hour >= 6 && hour < 17.5) return 'day'
  if (hour >= 17.5 && hour < 18.75) return 'dusk'
  return 'night'
}

function mixColor(a: number, b: number, t: number, gainA = 1, gainB = 1): Color {
  return new Color(a).multiplyScalar(gainA).lerp(new Color(b).multiplyScalar(gainB), t)
}

/** The sun's arc from east to west by day; the moon takes the same path through the night. */
function lightDirectionAt(hour: number): Vector3 {
  const night = hour < 6 || hour >= 18.5
  const along = night ? ((hour - 18.5 + 24) % 24) / 11.5 : (hour - 6) / 12.5
  const angle = Math.PI * Math.min(1, Math.max(0, along))
  // Never quite on the horizon: a grazing light would stretch every shadow across the whole farm.
  return new Vector3(Math.cos(angle) * 0.9, Math.max(0.16, Math.sin(angle)), 0.42).normalize()
}

export function daylightAtHour(hour: number): Daylight {
  let index = KEYS.findIndex(([at]) => at > hour)
  if (index <= 0) index = KEYS.length - 1
  const [fromHour, from] = KEYS[index - 1]
  const [toHour, to] = KEYS[index]
  const t = toHour === fromHour ? 0 : Math.min(1, Math.max(0, (hour - fromHour) / (toHour - fromHour)))
  const mix = (a: number, b: number) => a + (b - a) * t
  const phase = phaseAt(hour)
  return {
    phase,
    hour,
    lightDirection: lightDirectionAt(hour),
    lightColor: mixColor(from.lightColor, to.lightColor, t),
    lightIntensity: mix(from.lightIntensity, to.lightIntensity),
    hemisphereSky: mixColor(from.hemisphereSky, to.hemisphereSky, t),
    hemisphereGround: mixColor(from.hemisphereGround, to.hemisphereGround, t),
    hemisphereIntensity: mix(from.hemisphereIntensity, to.hemisphereIntensity),
    zenith: mixColor(from.zenith, to.zenith, t, from.zenithGain, to.zenithGain),
    horizon: mixColor(from.horizon, to.horizon, t, from.horizonGain, to.horizonGain),
    disc: mixColor(from.disc, to.disc, t),
    cloud: mixColor(from.cloud, to.cloud, t, from.cloudGain, to.cloudGain),
    fog: mixColor(from.fog, to.fog, t),
    stars: mix(from.stars, to.stars),
    environmentIntensity: mix(from.environmentIntensity, to.environmentIntensity),
    exposure: mix(from.exposure, to.exposure),
    lamps: mix(from.stars, to.stars) > 0.35,
  }
}

export function daylightFor(mode: DaylightMode, now = new Date()): Daylight {
  return daylightAtHour(mode === 'auto' ? bogotaHour(now) : FIXED_HOURS[mode])
}

const REFRESH_MS = 60_000

/** The light of the farm right now, refreshed every minute. A fixed mode pins it for a demonstration. */
export function useDaylight(mode: DaylightMode = 'auto'): Daylight {
  // The minute that last passed; a new one recomputes the light.
  const [minute, setMinute] = useState(0)
  useEffect(() => {
    if (mode !== 'auto') return
    const timer = setInterval(() => setMinute(value => value + 1), REFRESH_MS)
    return () => clearInterval(timer)
  }, [mode])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `minute` is the clock tick that makes "now" move
  return useMemo(() => daylightFor(mode), [mode, minute])
}

export function formatBogotaTime(hour: number): string {
  const whole = Math.floor(hour)
  const minutes = Math.floor((hour - whole) * 60)
  const suffix = whole >= 12 ? 'p. m.' : 'a. m.'
  const twelve = whole % 12 === 0 ? 12 : whole % 12
  return `${twelve}:${String(minutes).padStart(2, '0')} ${suffix}`
}
