import { Moon, Sun } from 'lucide-react'
import { theme, useTheme } from '../../lib/theme'
import styles from './ThemeToggle.module.css'

export interface ThemeToggleProps {
  className?: string
}

/** Icon button that flips between the light (default) and dark theme. */
export function ThemeToggle({ className }: ThemeToggleProps = {}) {
  const current = useTheme()
  const isDark = current === 'dark'
  const label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
  const Icon = isDark ? Sun : Moon

  return <button type="button" className={[styles.toggle, className].filter(Boolean).join(' ')}
    aria-label={label} title={label} onClick={() => theme.toggle()}>
    <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
  </button>
}
