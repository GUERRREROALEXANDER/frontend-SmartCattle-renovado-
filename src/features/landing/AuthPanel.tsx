import { useEffect, useRef } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link, useLocation } from 'react-router'
import { AuthForm } from '../auth/AuthForm'
import styles from './AuthPanel.module.css'

const COPY = {
  login: {
    title: 'Ingresa a tu finca',
    description: 'Tu ganado, tus zonas seguras y cada alerta, en un solo lugar.',
    question: '¿No tienes cuenta?', link: 'Crear cuenta', to: '/register',
  },
  register: {
    title: 'Crea tu cuenta',
    description: 'Empieza a cuidar tu finca con monitoreo claro y alertas oportunas.',
    question: '¿Ya tienes cuenta?', link: 'Ingresar', to: '/login',
  },
} as const

export interface AuthPanelProps {
  open: boolean
  mode: 'login' | 'register'
  onClose: () => void
}

/** The sign-in form as a small glass panel under the button, so the picture behind stays in view. */
export function AuthPanel({ open, mode, onClose }: AuthPanelProps) {
  const reduce = useReducedMotion() === true
  const location = useLocation()
  const copy = COPY[mode]
  const panel = useRef<HTMLElement>(null)

  // Keyboard and screen-reader users land in the form, and return to where they were when it closes.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }))
    return () => {
      cancelAnimationFrame(frame)
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          id="auth-panel"
          ref={panel}
          className={styles.panel}
          role="dialog"
          aria-labelledby="auth-panel-title"
          // The form scrolls by itself when it is taller than the window; the page's smooth scroll stays out of it.
          data-lenis-prevent
          initial={{ opacity: 0, y: reduce ? 0 : -14, scale: reduce ? 1 : 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reduce ? 0 : -10, scale: reduce ? 1 : 0.98 }}
          transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 320, damping: 28, mass: 0.8 }}
        >
          <header className={styles.head}>
            <span className={styles.badge}><ShieldCheck size={14} strokeWidth={2.2} aria-hidden="true" />Acceso seguro</span>
            <button type="button" className={styles.close} aria-label="Cerrar" onClick={onClose}>
              <X size={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </header>
          <h2 id="auth-panel-title" className={styles.title}>{copy.title}</h2>
          <p className={styles.description}>{copy.description}</p>
          <div className={styles.form}><AuthForm mode={mode} /></div>
          <p className={styles.footer}>
            {copy.question} <Link to={copy.to} replace state={location.state}>{copy.link}</Link>
          </p>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
