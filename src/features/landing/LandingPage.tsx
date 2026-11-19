import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, LogIn } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useLocation, useNavigate } from 'react-router'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { useDocumentTitle } from '../../app/useDocumentTitle'
import { BrandMark } from '../../components/ui/BrandMark'
import { getVideoInicio, type VideoInicio } from '../../services/videoInicioService'
import { AuthPanel } from './AuthPanel'
import { CINEMATIC_STOPS, CinematicScene } from './CinematicScene'
import styles from './LandingPage.module.css'

interface Chapter {
  id: string
  /** Name of the stop on the rail. */
  stop: string
  title: string
  body: string
}

/**
 * The story the shot tells, one chapter per stop of the camera (CinematicScene). Few words on purpose: the picture
 * tells it, each line only names what the system does there.
 */
const CHAPTERS: readonly Chapter[] = [
  { id: 'cielo', stop: 'Sobre las nubes', title: 'Tu finca, vigilada desde el cielo', body: 'Cámaras e inteligencia artificial que cuidan tu ganado.' },
  { id: 'finca', stop: 'La finca', title: 'Cada potrero, a la vista', body: 'Sin collares ni sensores en el animal.' },
  { id: 'ganado', stop: 'El ganado', title: 'Vacas y terneros, tranquilos', body: 'Tú sigues con tu día; el sistema los acompaña.' },
  { id: 'camara', stop: 'La cámara', title: 'Una cámara los cuida', body: 'De día y de noche, sin descanso.' },
  { id: 'deteccion', stop: 'Detección', title: 'Detecta cada animal', body: 'Y te avisa al WhatsApp si alguno sale de su zona.' },
  { id: 'entrar', stop: 'Tu finca', title: 'Tu ganado está seguro', body: 'Ingresa o regístrate para ver tu finca.' },
]
const LAST = CHAPTERS.length - 1
/** Two taps this close together on a phone move on; one alone is somebody scrolling or resting a thumb. */
const DOUBLE_TAP_MS = 340

gsap.registerPlugin(ScrollTrigger)

/** A video an administrator chose for the cover. The scroll plays it, forwards and backwards. */
function ScrubbedVideo({ video, progress, reduceMotion, onFail }: {
  video: VideoInicio; progress: React.RefObject<number>; reduceMotion: boolean; onFail: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      if (!Number.isFinite(element.duration) || element.duration <= 0) return
      const target = Math.min(0.999, Math.max(0, progress.current ?? 0)) * element.duration
      const gap = target - element.currentTime
      // Seeking on every frame stutters: move only when the scroll has really gone somewhere.
      if (Math.abs(gap) > 0.04) element.currentTime = reduceMotion ? target : element.currentTime + gap * 0.22
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [progress, reduceMotion])
  return <video ref={ref} className={styles.video} src={video.url} poster={video.posterUrl ?? undefined}
    muted playsInline preload="auto" aria-label={video.title ?? 'Video de presentación de SmartCattle'} onError={onFail} />
}

export function LandingPage() {
  useDocumentTitle()
  const reduce = useReducedMotion() === true
  const navigate = useNavigate()
  const location = useLocation()
  const mode = location.pathname.startsWith('/register') ? 'register' : 'login'
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
  // The site's own address is where a visitor arrives: they get the cover. Somebody sent here from a page inside
  // the app, or by a "create account" link, came to sign in, not to watch.
  const cameFromApp = typeof from === 'string' && from !== '/'
  const [panelOpen, setPanelOpen] = useState(mode === 'register' || cameFromApp)
  const [active, setActive] = useState(0)
  const [video, setVideo] = useState<VideoInicio | null>(null)
  const progress = useRef(0)
  const root = useRef<HTMLDivElement>(null)
  const lenis = useRef<Lenis | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void getVideoInicio({ signal: controller.signal }).then(found => {
      if (!controller.signal.aborted) setVideo(found)
    })
    return () => controller.abort()
  }, [])

  useLayoutEffect(() => {
    progress.current = 0
    const smooth = reduce ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 })
    lenis.current = smooth
    const raf = (time: number) => smooth?.raf(time * 1000)
    if (smooth) {
      smooth.on('scroll', ScrollTrigger.update)
      gsap.ticker.add(raf)
      gsap.ticker.lagSmoothing(0)
    }

    const context = gsap.context(() => {
      ScrollTrigger.create({
        trigger: `.${styles.track}`, start: 'top top', end: 'bottom bottom',
        onUpdate: self => {
          // With reduced motion the camera does not travel: each chapter cuts straight to its own picture.
          progress.current = reduce ? Math.round(self.progress * LAST) / LAST : self.progress
          setActive(Math.min(LAST, Math.round(self.progress * LAST)))
        },
      })
      gsap.utils.toArray<HTMLElement>(`.${styles.chapter}`).forEach(section => {
        const copy = section.querySelector(`.${styles.copy}`)
        if (!copy) return
        if (reduce) {
          gsap.set(copy, { autoAlpha: 1 })
          return
        }
        // The camera is the motion on this page. The words only trade places: a short cross-fade, no flourish.
        gsap.timeline({ scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 0.4 } })
          .fromTo(copy, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power1.out' }, 0.24)
          .to(copy, { autoAlpha: 0, y: -20, duration: 0.16, ease: 'power1.in' }, 0.62)
          .set({}, {}, 1)
      })
    }, root)

    return () => {
      context.revert()
      gsap.ticker.remove(raf)
      smooth?.destroy()
      lenis.current = null
      // The app's pages start at the top, wherever the visitor left the cover.
      window.scrollTo(0, 0)
    }
  }, [reduce])

  const goTo = useCallback((index: number) => {
    const top = Math.min(LAST, Math.max(0, index)) * window.innerHeight
    // Long enough for the shot between two stops to be watched, not skipped.
    if (lenis.current) lenis.current.scrollTo(top, { duration: 2.4 })
    else window.scrollTo({ top, behavior: 'auto' })
  }, [])

  // Read by listeners that outlive a render, so they always move on from where the page is now.
  const activeRef = useRef(0)
  useEffect(() => { activeRef.current = active }, [active])

  // The keyboard walks the shot too: Enter or the arrows, as long as nobody is typing or pressing a control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, textarea, select, button, a, [role="dialog"]')) return
      const step = event.key === 'Enter' || event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ' ? 1
        : event.key === 'ArrowUp' || event.key === 'PageUp' ? -1 : 0
      if (!step) return
      event.preventDefault()
      goTo(activeRef.current + step)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo])

  // With a mouse one click on the picture moves on. A finger needs two taps: one alone happens all the time.
  const lastTap = useRef(0)
  const onStage = (event: React.MouseEvent) => {
    const pointer = (event.nativeEvent as PointerEvent).pointerType
    if (pointer === 'touch' || pointer === 'pen') {
      const now = event.timeStamp
      const double = now - lastTap.current < DOUBLE_TAP_MS
      lastTap.current = double ? 0 : now
      if (!double) return
    }
    goTo(activeRef.current + 1)
  }
  const [coarse] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)

  const openPanel = (next: 'login' | 'register') => {
    setPanelOpen(true)
    const path = next === 'register' ? '/register' : '/login'
    if (location.pathname !== path) void navigate(path, { replace: true, state: location.state })
  }

  // The cover's cinematic photo/video needs the pale ink the dark palette gives it; it does not follow the toggle.
  return (
    <div ref={root} className={styles.page} data-theme="dark">
      {/* A click anywhere on the picture (two taps on a phone) moves on to the next stop, like the scroll does. */}
      <div className={styles.stage} onClick={onStage} role="presentation">
        {video !== null
          ? <ScrubbedVideo video={video} progress={progress} reduceMotion={reduce} onFail={() => setVideo(null)} />
          : <CinematicScene progress={progress} reduceMotion={reduce} />}
        <div className={styles.scrim} aria-hidden="true" />
      </div>

      <header className={styles.top}>
        <BrandMark tone="on-dark" />
        <button type="button" className={styles.login} aria-expanded={panelOpen} aria-controls="auth-panel"
          onClick={() => (panelOpen ? setPanelOpen(false) : openPanel('login'))}>
          <LogIn size={17} strokeWidth={2.2} aria-hidden="true" />
          Ingresar / Login
        </button>
      </header>

      <main className={styles.track}>
        {CHAPTERS.map((chapter, index) => {
          const Title = index === 0 ? 'h1' : 'h2'
          return (
            <section key={chapter.id} className={styles.chapter} aria-labelledby={`chapter-${chapter.id}`}>
              <div className={styles.copy}>
                <Title id={`chapter-${chapter.id}`} className={index === 0 ? styles.display : styles.title}>{chapter.title}</Title>
                <p className={styles.body}>{chapter.body}</p>
                {index === LAST && (
                  <div className={styles.actions}>
                    <button type="button" className={styles.primary} onClick={() => openPanel('login')}>Ingresar</button>
                    <button type="button" className={styles.secondary} onClick={() => openPanel('register')}>Registrarme</button>
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </main>

      {/* The stops of the shot, to jump to any of them. */}
      <nav className={styles.rail} aria-label="Paradas del recorrido">
        <div className={styles.scale}>
          <ol className={styles.stops}>
            {CHAPTERS.map((chapter, index) => (
              <li key={chapter.id}>
                <button type="button" className={styles.stop} aria-current={index === active ? 'step' : undefined}
                  onClick={() => goTo(index)}>{chapter.stop}</button>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      {active < LAST && (
        <button type="button" className={styles.next} onClick={() => goTo(active + 1)}>
          <span>{reduce ? 'Sigue leyendo' : coarse
            ? (active === 0 ? 'Desliza o toca dos veces para bajar' : 'Toca dos veces para seguir')
            : (active === 0 ? 'Pulsa Enter, haz clic o desliza para bajar' : 'Enter o clic para seguir')}</span>
          <ChevronDown size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>
      )}

      <AuthPanel open={panelOpen} mode={mode} onClose={() => setPanelOpen(false)} />
    </div>
  )
}

// The scene and the page must agree on how many stops there are; a mismatch would leave a chapter without a picture.
if (import.meta.env.DEV && CHAPTERS.length !== CINEMATIC_STOPS) console.error('LandingPage: los capítulos no coinciden con las paradas de la escena')
