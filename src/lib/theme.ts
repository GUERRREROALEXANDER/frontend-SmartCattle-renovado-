import { useSyncExternalStore } from 'react'
import { safeStorage } from './safeStorage'

// App-wide color theme: light is the default; dark is kept exactly as it was.

export type Theme = 'light' | 'dark'

const THEME_KEY = 'smartcattle.theme'

type Listener = () => void

function readStored(): Theme {
  return safeStorage.getJson<Theme>(THEME_KEY) === 'dark' ? 'dark' : 'light'
}

function applyToDocument(next: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', next)
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', next === 'dark' ? '#051F20' : '#FAF6EE')
}

let state: Theme = readStored()
const listeners = new Set<Listener>()
applyToDocument(state)

export const theme = {
  getState: (): Theme => state,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  set(next: Theme) {
    if (next === state) return
    state = next
    safeStorage.setJson(THEME_KEY, next)
    applyToDocument(next)
    listeners.forEach((listener) => listener())
  },
  toggle() {
    theme.set(state === 'dark' ? 'light' : 'dark')
  },
}

export function useTheme(): Theme {
  return useSyncExternalStore(theme.subscribe, theme.getState, theme.getState)
}
