import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { CameraPreset } from './cameraPresets'

const FLIGHT_SECONDS = 1.3
/** The first flight comes down from the sky, so it takes its time. */
const INTRO_SECONDS = 3.6
const PAN_LIMIT = 55
const NARROW_ASPECT = 1.4

interface OrbitTarget {
  target: Vector3
  update: () => void
  addEventListener: (type: 'start', listener: () => void) => void
  removeEventListener: (type: 'start', listener: () => void) => void
}

interface Flight {
  fromPosition: Vector3
  fromTarget: Vector3
  toPosition: Vector3
  toTarget: Vector3
  elapsed: number
  seconds: number
}

export interface CameraRigProps {
  preset: CameraPreset
  /** Changes on every request, so picking the same preset again flies back to it. */
  request: number
  reduceMotion: boolean
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export function CameraRig({ preset, request, reduceMotion }: CameraRigProps) {
  const camera = useThree(state => state.camera)
  const getState = useThree(state => state.get)
  const controls = useThree(state => state.controls) as unknown as OrbitTarget | null
  const flight = useRef<Flight | null>(null)
  const arrived = useRef(false)

  useEffect(() => {
    if (!controls) return
    const toTarget = new Vector3(...preset.target)
    // Presets are framed for a wide canvas; pull back on narrow (phone) canvases.
    const { size } = getState()
    const aspect = size.width / Math.max(1, size.height)
    const pullBack = Math.min(1.8, Math.max(1, NARROW_ASPECT / aspect))
    const toPosition = new Vector3(...preset.position).sub(toTarget).multiplyScalar(pullBack).add(toTarget)

    if (reduceMotion) {
      arrived.current = true
      flight.current = null
      camera.position.copy(toPosition)
      controls.target.copy(toTarget)
      controls.update()
      return
    }

    flight.current = {
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPosition,
      toTarget,
      elapsed: 0,
      seconds: arrived.current ? FLIGHT_SECONDS : INTRO_SECONDS,
    }
    arrived.current = true
  }, [camera, controls, getState, preset, reduceMotion, request])

  // Grabbing the scene cancels a flight in progress instead of fighting the user.
  useEffect(() => {
    if (!controls) return
    const cancel = () => {
      flight.current = null
    }
    controls.addEventListener('start', cancel)
    return () => controls.removeEventListener('start', cancel)
  }, [controls])

  useFrame((_, delta) => {
    if (!controls) return
    const current = flight.current
    if (!current) {
      // Panning may not drag the orbit centre off the farm or under the ground.
      const { target } = controls
      const clampedX = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, target.x))
      const clampedZ = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, target.z))
      if (clampedX !== target.x || clampedZ !== target.z || target.y !== 0) {
        target.set(clampedX, 0, clampedZ)
        controls.update()
      }
      return
    }

    current.elapsed = Math.min(current.seconds, current.elapsed + delta)
    const t = easeInOutCubic(current.elapsed / current.seconds)
    camera.position.lerpVectors(current.fromPosition, current.toPosition, t)
    controls.target.lerpVectors(current.fromTarget, current.toTarget, t)
    controls.update()

    if (current.elapsed >= current.seconds) flight.current = null
  })

  return null
}
