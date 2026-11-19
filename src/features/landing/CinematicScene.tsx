import { useEffect, useRef, type RefObject } from 'react'
import camara from './media/camara.webp'
import cielo from './media/cielo.webp'
import ganadero from './media/ganadero.webp'
import ganado from './media/ganado.webp'
import potrero from './media/potrero-aereo.webp'
import styles from './CinematicScene.module.css'

// The cover as one continuous shot made of photographs: above the clouds, down to a paddock seen from the air, in
// among the herd, back into the lens of the camera that watches it, and out of the screen of the person who is
// looking at that camera. The scroll is the only clock; every picture is moved by it, never by a timer of its own.

/** How many stops the shot has. The page's chapters are the same ones, in the same order. */
export const CINEMATIC_STOPS = 6

interface Shot {
  /** Width divided by height of the picture. */
  ratio: number
  /** The point of the picture that must stay in view when the window crops it, as fractions of its size. */
  focus: readonly [number, number]
}

const SHOTS = {
  sky: { ratio: 900 / 1600, focus: [0.62, 0.5] },
  aerial: { ratio: 800 / 657, focus: [0.5, 0.5] },
  herd: { ratio: 1, focus: [0.45, 0.58] },
  camera: { ratio: 1024 / 1016, focus: [0.43, 0.36] },
  farmer: { ratio: 1145 / 1074, focus: [0.56, 0.5] },
} as const satisfies Record<string, Shot>
type ShotName = keyof typeof SHOTS
const LAYERS = ['sky', 'aerial', 'herd', 'camera', 'farmer', 'veil', 'detect', 'screen'] as const
type LayerName = typeof LAYERS[number]

/** The middle of the camera's lens: the shot goes in through it. */
const LENS = [0.415, 0.2756] as const
/** The four corners of the laptop's screen in the last picture, clockwise from the top left. */
const SCREEN = [[0.4891, 0.4283], [0.6885, 0.4392], [0.6652, 0.5866], [0.4681, 0.5587]] as const
/** The size the laptop's picture is drawn at before it is laid over the screen. */
const SCREEN_SIZE = [480, 300] as const

/** What the model marks in the herd's picture: [left, top, width, height] as fractions, and what it is. */
const BOXES: readonly (readonly [number, number, number, number, 'Vaca' | 'Ternero', number])[] = [
  [0.315, 0.465, 0.3, 0.275, 'Vaca', 0.97],
  [0.288, 0.585, 0.225, 0.155, 'Ternero', 0.93],
  [0, 0.44, 0.212, 0.165, 'Vaca', 0.95],
  [0.62, 0.44, 0.215, 0.15, 'Vaca', 0.94],
  [0.875, 0.42, 0.125, 0.115, 'Vaca', 0.9],
  [0.885, 0.475, 0.1, 0.09, 'Ternero', 0.86],
  [0.268, 0.418, 0.05, 0.072, 'Vaca', 0.88],
  [0.378, 0.41, 0.045, 0.062, 'Vaca', 0.84],
  [0.482, 0.412, 0.082, 0.06, 'Vaca', 0.9],
  [0.575, 0.402, 0.082, 0.056, 'Vaca', 0.87],
  [0.655, 0.408, 0.075, 0.05, 'Vaca', 0.85],
  [0.762, 0.418, 0.07, 0.055, 'Vaca', 0.89],
]

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
/** 0 before `from`, 1 after `to`, straight in between. */
const ramp = (from: number, to: number, value: number) => clamp01((value - from) / (to - from))
const ease = (value: number) => value * value * (3 - 2 * value)

interface Box { left: number; top: number; width: number; height: number }

/** Where a picture sits so that it covers the window with its focus as near the middle as its edges allow. */
function coverBox(shot: Shot, width: number, height: number): Box {
  const w = Math.max(width, height * shot.ratio)
  const h = w / shot.ratio
  const left = Math.min(0, Math.max(width - w, width / 2 - shot.focus[0] * w))
  const top = Math.min(0, Math.max(height - h, height / 2 - shot.focus[1] * h))
  return { left, top, width: w, height: h }
}

/** The CSS matrix that lays a w x h rectangle over four corners (top left, top right, bottom right, bottom left). */
function quadMatrix(w: number, h: number, quad: readonly (readonly [number, number])[]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3
  const det = dx1 * dy2 - dx2 * dy1
  const g = det === 0 ? 0 : (dx3 * dy2 - dx2 * dy3) / det
  const k = det === 0 ? 0 : (dx1 * dy3 - dx3 * dy1) / det
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3
  const d = y1 - y0 + g * y1, e = y3 - y0 + k * y3
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${k / h},0,0,1,0,${x0},${y0},0,1)`
}

/** The herd as the camera's software shows it: the picture, a box on each animal, and the readout of a live feed. */
function DetectionView({ compact = false }: { compact?: boolean }) {
  const cattle = BOXES.length
  return (
    <div className={styles.feed} data-compact={compact || undefined}>
      <div className={styles.square}>
        <img src={ganado} alt="" draggable={false} decoding="async" />
        {BOXES.map(([left, top, width, height, label, score], index) => (
          <span key={index} className={styles.box} data-kind={label === 'Ternero' ? 'calf' : 'cow'}
            style={{ left: `${left * 100}%`, top: `${top * 100}%`, width: `${width * 100}%`, height: `${height * 100}%`, transitionDelay: `${index * 55}ms` }}>
            {/* Only the animals in the foreground are big enough to carry a label. */}
            {width > 0.09 && <span className={styles.tag}>{label} {score.toFixed(2)}</span>}
          </span>
        ))}
      </div>
      <div className={styles.scan} />
      <div className={styles.hud}>
        <span className={styles.rec}>EN VIVO</span>
        <span>CAM 01 · Lote Norte</span>
      </div>
      <div className={styles.count}>
        <strong>{cattle}</strong> bovinos detectados · 0 fuera de la zona segura
      </div>
    </div>
  )
}

export interface CinematicSceneProps {
  /** 0 above the clouds, 1 beside the person watching the cameras. Read every frame, so it never re-renders. */
  progress: RefObject<number>
  reduceMotion: boolean
}

export function CinematicScene({ progress, reduceMotion }: CinematicSceneProps) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = root.current
    if (!stage) return
    // Found once by name: the pictures never change while the scene is mounted.
    const layers = { current: Object.fromEntries(LAYERS.map(name => [name, stage.querySelector<HTMLDivElement>(`[data-layer="${name}"]`)])) as Record<LayerName, HTMLDivElement | null> }
    let size = { width: stage.clientWidth, height: stage.clientHeight }
    let farmer: Box = coverBox(SHOTS.farmer, size.width, size.height)

    const layout = () => {
      size = { width: stage.clientWidth, height: stage.clientHeight }
      for (const name of Object.keys(SHOTS) as ShotName[]) {
        const element = layers.current[name]
        if (!element) continue
        const box = coverBox(SHOTS[name], size.width, size.height)
        if (name === 'farmer') farmer = box
        Object.assign(element.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` })
      }
      const screen = layers.current.screen
      if (screen) {
        screen.style.transform = quadMatrix(SCREEN_SIZE[0], SCREEN_SIZE[1],
          SCREEN.map(([x, y]) => [x * farmer.width, y * farmer.height] as const))
      }
    }
    layout()
    const observer = new ResizeObserver(layout)
    observer.observe(stage)

    const show = (element: HTMLDivElement | null | undefined, opacity: number, transform?: string) => {
      if (!element) return
      element.style.opacity = String(opacity)
      element.style.visibility = opacity < 0.004 ? 'hidden' : 'visible'
      if (transform !== undefined) element.style.transform = transform
    }

    let eased = clamp01(progress.current ?? 0) * (CINEMATIC_STOPS - 1)
    let last = 0
    let frame = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const delta = last === 0 ? 0 : Math.min(0.1, (now - last) / 1000)
      last = now
      const target = clamp01(progress.current ?? 0) * (CINEMATIC_STOPS - 1)
      // A little behind the scroll, so a jump of the wheel is still one movement of the camera.
      eased = reduceMotion ? target : eased + (target - eased) * Math.min(1, delta * 4.2)
      const s = eased
      // The breath of a hand-held shot while the page rests on a stop.
      const breath = reduceMotion ? 0 : Math.sin(now / 4200)
      const { sky, veil, aerial, herd, camera, detect, farmer: farmerLayer } = layers.current

      // 0 → 1: over the clouds, then down into them.
      show(sky, 1 - ramp(0.5, 0.8, s), `scale(${1.04 + 0.62 * ease(ramp(0, 1, s)) + breath * 0.008})`)
      const through = ramp(0.3, 0.64, s) * (1 - ramp(0.72, 0.97, s))
      show(veil, through, `scale(${1 + 1.2 * ramp(0.3, 0.97, s)})`)

      // 1 → 2: out of the clouds over a paddock, coming down on the herd.
      const descent = Math.pow(ramp(0.66, 2, s), 1.6)
      show(aerial, ramp(0.6, 0.86, s) * (1 - ramp(1.62, 1.96, s)),
        `scale(${1.02 + 1.1 * descent + breath * 0.006}) rotate(${-5 * descent}deg)`)

      // 2: among the animals.
      show(herd, ramp(1.62, 1.96, s) * (1 - ramp(2.5, 2.86, s)),
        `scale(${1.32 - 0.3 * ease(ramp(1.6, 2.05, s)) + 0.05 * ramp(2, 2.9, s) + breath * 0.006})`)

      // 3: backing away until the camera that watches them is in frame, then in through its lens.
      const dive = Math.pow(ramp(3.06, 3.9, s), 3)
      show(camera, ramp(2.5, 2.86, s) * (1 - ramp(3.62, 3.9, s)),
        `scale(${1.28 - 0.28 * ease(ramp(2.5, 3, s)) + 15 * dive + breath * 0.004})`)

      // 4: what the camera sees, with every animal marked.
      const seen = ramp(3.62, 3.92, s) * (1 - ramp(4.04, 4.3, s))
      show(detect, seen, `scale(${1.22 - 0.22 * ease(ramp(3.6, 4, s))})`)
      detect?.toggleAttribute('data-on', s > 3.8)

      // 5: backing out of that picture: it was on the screen of the person looking after the herd.
      const out = ease(ramp(4.04, 4.96, s))
      const screenLeft = Math.min(...SCREEN.map(([x]) => x)) * farmer.width
      const screenRight = Math.max(...SCREEN.map(([x]) => x)) * farmer.width
      const screenTop = Math.min(...SCREEN.map(([, y]) => y)) * farmer.height
      const screenBottom = Math.max(...SCREEN.map(([, y]) => y)) * farmer.height
      const fill = Math.max(size.width / (screenRight - screenLeft), size.height / (screenBottom - screenTop)) * 1.04
      const zoom = Math.pow(fill, 1 - out)
      const along = fill > 1 ? (zoom - 1) / (fill - 1) : 0
      const centerX = (screenLeft + screenRight) / 2, centerY = (screenTop + screenBottom) / 2
      if (farmerLayer) farmerLayer.style.transformOrigin = `${centerX}px ${centerY}px`
      show(farmerLayer, ramp(4.02, 4.26, s),
        `translate(${(size.width / 2 - farmer.left - centerX) * along}px, ${(size.height / 2 - farmer.top - centerY) * along}px) scale(${zoom + breath * 0.003 * out})`)
      farmerLayer?.toggleAttribute('data-on', s > 4.02)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [progress, reduceMotion])

  return (
    <div ref={root} className={styles.scene} aria-hidden="true">
      <div data-layer="sky" className={styles.shot} style={{ transformOrigin: '62% 64%' }}>
        <img src={cielo} alt="" draggable={false} fetchPriority="high" />
        <div className={styles.sun} />
      </div>
      <div data-layer="aerial" className={styles.shot} style={{ transformOrigin: '46% 52%' }}>
        <img src={potrero} alt="" draggable={false} decoding="async" />
      </div>
      <div data-layer="veil" className={styles.veil} />
      <div data-layer="herd" className={styles.shot} style={{ transformOrigin: '45% 60%' }}>
        <img src={ganado} alt="" draggable={false} decoding="async" />
      </div>
      <div data-layer="camera" className={styles.shot} style={{ transformOrigin: `${LENS[0] * 100}% ${LENS[1] * 100}%` }}>
        <img src={camara} alt="" draggable={false} decoding="async" />
      </div>
      <div data-layer="detect" className={styles.detect}>
        <DetectionView />
      </div>
      <div data-layer="farmer" className={styles.shot}>
        <img src={ganadero} alt="" draggable={false} decoding="async" />
        <div data-layer="screen" className={styles.screen} style={{ width: SCREEN_SIZE[0], height: SCREEN_SIZE[1] }}>
          <DetectionView compact />
        </div>
      </div>
      <div className={styles.grade} />
    </div>
  )
}
