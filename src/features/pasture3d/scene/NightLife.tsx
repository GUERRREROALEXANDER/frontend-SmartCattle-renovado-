import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, RingGeometry, SphereGeometry } from 'three'
import type { Group } from 'three'
import type { HerdAgent } from '../../../live/herdMotion'
import { heightAt } from '../kit/terrain/heightfield'

// What only shows after dark: the barn and camera lamps, and the glow that keeps the herd readable.

const bulbGeometry = new SphereGeometry(0.12, 12, 8)
const haloGeometry = new RingGeometry(0.75, 1.25, 40).rotateX(-Math.PI / 2)
const WARM = new Color('#ffcf8a')
const COOL = new Color('#dfeaff')
const NIGHT_VISION = new Color('#6dffb0')
/** Each lamp is a real light: more than a few and a laptop starts dropping frames. */
const MAX_POLE_LAMPS = 4

export function BarnLamp({ position }: { position: [number, number, number] }) {
  const ground = heightAt(position[0], position[2])
  return (
    <group position={[position[0], ground, position[2]]}>
      <pointLight position={[5.2, 3.4, 0]} color={WARM} intensity={70} distance={30} decay={2} />
      <mesh geometry={bulbGeometry} position={[4.6, 3.5, 0]}>
        <meshBasicMaterial color={WARM} toneMapped={false} />
      </mesh>
      <pointLight position={[-1, 2.2, 1]} color={WARM} intensity={18} distance={12} decay={2} />
    </group>
  )
}

export function PoleLamps({ poles }: { poles: readonly { id: string; position: [number, number, number] }[] }) {
  return (
    <>
      {poles.slice(0, MAX_POLE_LAMPS).map(pole => (
        <group key={pole.id} position={[pole.position[0], heightAt(pole.position[0], pole.position[2]) + 3.2, pole.position[2]]}>
          <pointLight color={COOL} intensity={26} distance={18} decay={2} />
          <mesh geometry={bulbGeometry} scale={0.7}>
            <meshBasicMaterial color={COOL} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** Night vision: a soft green ring that follows each animal, the way the cameras' infrared picks it out. */
export function NightHalo({ agent, reduceMotion }: { agent: HerdAgent; reduceMotion: boolean }) {
  const ref = useRef<Group>(null)
  useFrame(state => {
    const group = ref.current
    if (!group) return
    group.position.set(agent.position.x, heightAt(agent.position.x, agent.position.z) + 0.04, agent.position.z)
    const breathe = reduceMotion ? 0 : Math.sin(state.clock.elapsedTime * 1.6 + agent.position.x) * 0.05
    group.scale.setScalar(1 + breathe)
  })
  return (
    <group ref={ref}>
      <mesh geometry={haloGeometry} renderOrder={2}>
        <meshBasicMaterial color={NIGHT_VISION} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
