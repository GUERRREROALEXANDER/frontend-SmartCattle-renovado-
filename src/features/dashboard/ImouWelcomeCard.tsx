import { useState } from 'react'
import { Cctv } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button, GlassCard } from '../../components/ui'
import { safeStorage } from '../../lib/safeStorage'
import styles from './ImouWelcomeCard.module.css'

const DISMISSED_KEY = 'smartcattle.imouWelcome.dismissed'

export interface ImouWelcomeCardProps {
  /** True once the farm's cameras have loaded and there are none yet. */
  show: boolean
}

/** A one-time, dismissible nudge to connect an Imou camera; it never blocks the dashboard. */
export function ImouWelcomeCard({ show }: ImouWelcomeCardProps) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => safeStorage.getJson<boolean>(DISMISSED_KEY) ?? false)
  if (!show || dismissed) return null

  const dismiss = () => {
    safeStorage.setJson(DISMISSED_KEY, true)
    setDismissed(true)
  }

  return <GlassCard tone="brand" padding="lg" className={styles.card} role="region" aria-labelledby="imou-welcome-title">
    <span className={styles.icon} aria-hidden="true"><Cctv size={22} strokeWidth={1.75} /></span>
    <div className={styles.body}>
      <h2 id="imou-welcome-title" className={styles.title}>¿Quieres conectar tu cámara Imou Ranger 2 Pro?</h2>
      <p className={styles.text}>Se abre por la nube de Imou, sin cables ni direcciones IP. Puedes hacerlo ahora o más tarde desde Cámaras.</p>
    </div>
    <div className={styles.actions}>
      <Button icon={Cctv} onClick={() => navigate('/cameras')}>Conectar cámara</Button>
      <button type="button" className={styles.dismiss} onClick={dismiss}>Ahora no</button>
    </div>
  </GlassCard>
}
