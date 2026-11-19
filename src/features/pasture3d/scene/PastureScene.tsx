import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ACESFilmicToneMapping, Color } from 'three'
import type { HerdAgent } from '../../../live/herdMotion'
import type { ZoneSummary } from '../../../live/herdSummary'
import type { FarmPlan } from '../../../services/farmLayout'
import type { CameraStatus } from '../../../types/domain'
import { Cow } from '../kit/animals/Cow'
import type { Daylight } from '../kit/environment/daylight'
import { Sky } from '../kit/environment/Sky'
import { PerimeterFence } from '../kit/fences/PerimeterFence'
import { ZoneFence } from '../kit/fences/ZoneFence'
import { Grass } from '../kit/nature/Grass'
import { Rocks } from '../kit/nature/Rocks'
import { Trees } from '../kit/nature/Trees'
import { Person } from '../kit/people/Person'
import { Barn } from '../kit/structures/Barn'
import { CameraPole } from '../kit/structures/CameraPole'
import { WaterTrough } from '../kit/structures/WaterTrough'
import { Ground } from '../kit/terrain/Ground'
import { extendTrack } from '../kit/terrain/paths'
import { Track } from '../kit/terrain/Track'
import { CameraRig } from './CameraRig'
import type { CameraPreset } from './cameraPresets'
import { CowLabel } from './CowLabel'
import { LabelPool, type FloatingLabel } from './LabelPool'
import { AgentRing, CameraBeacon, DetectionLabel, ObjectBeacon } from './LiveMarkers'
import { LotMarkers } from './LotMarkers'
import { BarnLamp, NightHalo, PoleLamps } from './NightLife'
import { sceneLots, sceneTrack } from './sceneLots'
import { BARN_POSITION, buildCameraPoles, buildScenery, PERIMETER, TROUGH_POSITION } from './scenery'

export interface PastureSceneProps {
  plan: FarmPlan
  agents: readonly HerdAgent[]
  /** Advances the live herd; called every frame. */
  step: (delta: number) => void
  zones: readonly ZoneSummary[]
  cameraStatus: ReadonlyMap<string, CameraStatus>
  cameraNames: ReadonlyMap<string, string>
  preset: CameraPreset
  presetRequest: number
  showNames: boolean
  reduceMotion: boolean
  /** Light of the moment: the farm's own clock, or a fixed phase. */
  daylight: Daylight
  /** Flies the camera to a lot when its marker asks for it. */
  onFocusLot?: (lotId: string) => void
}

/** Where the camera starts before it comes down to the first view. */
const INTRO_POSITION: [number, number, number] = [0, 190, 150]
const YARDS = [
  { x: BARN_POSITION.x + 5.5, z: BARN_POSITION.z, radius: 5 },
  { x: TROUGH_POSITION.x, z: TROUGH_POSITION.z, radius: 3.2 },
]
const CLEARINGS = [
  { x: BARN_POSITION.x, z: BARN_POSITION.z - 1, radius: 7 },
  { x: TROUGH_POSITION.x, z: TROUGH_POSITION.z, radius: 1.8 },
]

function Exposure({ value }: { value: number }) {
  const gl = useThree(state => state.gl)
  useEffect(() => {
    Object.assign(gl, { toneMappingExposure: value })
  }, [gl, value])
  return null
}

function HerdDriver({ step }: { step: (delta: number) => void }) {
  useFrame((_, delta) => step(delta))
  return null
}

const LABEL_LAYER: CSSProperties = { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }

export function PastureScene({
  plan, agents, step, zones, cameraStatus, cameraNames, preset, presetRequest, showNames, reduceMotion, daylight, onFocusLot,
}: PastureSceneProps) {
  const lots = useMemo(() => sceneLots(plan), [plan])
  const track = useMemo(() => sceneTrack(plan), [plan])
  const road = useMemo(() => extendTrack(track), [track])
  const scenery = useMemo(() => buildScenery(lots, road), [lots, road])
  const cameraPoles = useMemo(() => buildCameraPoles(plan), [plan])
  const breached = useMemo(() => new Set(zones.filter(zone => zone.breached).map(zone => zone.lotId)), [zones])
  const labelLayer = useRef<HTMLDivElement>(null!)
  const fogColor = useMemo(() => new Color().copy(daylight.fog), [daylight])
  const sunPosition = useMemo(() => daylight.lightDirection.clone().multiplyScalar(90).toArray(), [daylight])
  const lotCameras = useMemo(() => new Map(plan.cameras.map(camera => [camera.lotId, {
    name: cameraNames.get(camera.cameraId) ?? camera.cameraId, status: cameraStatus.get(camera.cameraId) ?? 'offline' as const,
  }])), [plan, cameraNames, cameraStatus])
  const lotNames = useMemo(() => new Map(lots.map(lot => [lot.id, lot.name])), [lots])
  // Alerts first, then people, then the optional names, so the urgent tags keep their slots steady.
  const labels = useMemo<FloatingLabel[]>(() => {
    const lotName = (agent: HerdAgent) => lotNames.get(agent.lotId) ?? agent.lotId
    const alerts: FloatingLabel[] = []
    const detections: FloatingLabel[] = []
    const names: FloatingLabel[] = []
    for (const agent of agents) {
      if (agent.kind !== 'cow') {
        detections.push({ id: agent.id, agent, height: 2.25, content: <DetectionLabel agent={agent} lotName={lotName(agent)} /> })
      } else if (agent.outside) {
        alerts.push({ id: agent.id, agent, height: 2.35, content: <CowLabel cowName={agent.name} lotName={lotName(agent)} variant="alert" posture={agent.posture} /> })
      } else if (showNames) {
        names.push({ id: agent.id, agent, height: 2.05, content: <CowLabel cowName={agent.name} lotName={lotName(agent)} variant="name" posture={agent.posture} /> })
      }
    }
    return [...alerts, ...detections, ...names]
  }, [agents, lotNames, showNames])

  return (
    <>
    <Canvas
      dpr={[1, 1.75]}
      shadows="percentage"
      camera={{ position: reduceMotion ? preset.position : INTRO_POSITION, fov: 42, near: 0.3, far: 700 }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }}
    >
      <Exposure value={daylight.exposure} />
      <fog attach="fog" args={[fogColor, 70, 340]} />
      <Sky fogColor={fogColor} look={daylight} environmentIntensity={daylight.environmentIntensity} />
      <hemisphereLight args={[daylight.hemisphereSky, daylight.hemisphereGround, daylight.hemisphereIntensity]} />
      <directionalLight
        position={sunPosition}
        intensity={daylight.lightIntensity}
        color={daylight.lightColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={4}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-62}
        shadow-camera-right={62}
        shadow-camera-top={48}
        shadow-camera-bottom={-48}
        shadow-camera-near={10}
        shadow-camera-far={200}
      />

      <Ground lots={lots} track={road} yards={YARDS} />
      <Track points={road} width={2.6} />
      <Grass lots={lots} track={road} clearings={CLEARINGS} windy={!reduceMotion} />

      <PerimeterFence halfX={PERIMETER.halfX} halfZ={PERIMETER.halfZ} track={road} />
      {lots.map(lot => (
        <ZoneFence key={lot.id} lot={lot} track={track} breached={breached.has(lot.id)} />
      ))}

      <Barn position={[BARN_POSITION.x, 0, BARN_POSITION.z]} />
      <WaterTrough position={[TROUGH_POSITION.x, 0, TROUGH_POSITION.z]} heading={Math.PI / 2} />
      {cameraPoles.map(pole => (
        <group key={pole.id}>
          <CameraPole position={pole.position} heading={pole.heading} />
          <CameraBeacon position={pole.position} status={cameraStatus.get(pole.id) ?? 'offline'}
            label={cameraNames.get(pole.id) ?? pole.id} showLabel={showNames} reduceMotion={reduceMotion} portal={labelLayer} />
        </group>
      ))}
      <Trees trees={scenery.trees} windy={!reduceMotion} />
      {daylight.lamps && <>
        <BarnLamp position={[BARN_POSITION.x, 0, BARN_POSITION.z]} />
        <PoleLamps poles={cameraPoles} />
      </>}
      <Rocks clusters={scenery.rocks} />

      {agents.map(agent => agent.kind === 'cow'
        ? <group key={agent.id}>
          <Cow cow={agent} alert={agent.outside} />
          <AgentRing agent={agent} reduceMotion={reduceMotion} />
          {daylight.lamps && !agent.outside && <NightHalo agent={agent} reduceMotion={reduceMotion} />}
        </group>
        : <group key={agent.id}>
          {agent.kind === 'person' ? <Person person={agent} /> : <ObjectBeacon agent={agent} />}
          <AgentRing agent={agent} reduceMotion={reduceMotion} />
        </group>)}
      <LabelPool labels={labels} portal={labelLayer} />
      <LotMarkers lots={lots} zones={zones} lotCameras={lotCameras} portal={labelLayer} onFocus={onFocusLot} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={130}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.1}
        screenSpacePanning={false}
      />
      <CameraRig preset={preset} request={presetRequest} reduceMotion={reduceMotion} />
      <HerdDriver step={step} />
    </Canvas>
    {/* Stable home for every <Html> label: their roots mount once instead of moving when the canvas connects. */}
    <div ref={labelLayer} style={LABEL_LAYER} />
    </>
  )
}
