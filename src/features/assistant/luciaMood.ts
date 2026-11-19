export type LuciaMood = 'idle' | 'thinking' | 'talking' | 'alert'

const TALK_MS_PER_CHARACTER = 28
const TALK_MIN_MS = 1200
const TALK_MAX_MS = 5000

/** How long she keeps talking after an answer: a long one takes longer, and none goes on forever. */
export function talkingMs(text: string): number {
  return Math.min(TALK_MAX_MS, Math.max(TALK_MIN_MS, text.length * TALK_MS_PER_CHARACTER))
}

/** A question always comes first; with nothing to answer, an open alert has her attention. */
export function luciaMood(busy: boolean, talking: boolean, alert = false): LuciaMood {
  if (busy) return 'thinking'
  if (talking) return 'talking'
  return alert ? 'alert' : 'idle'
}
