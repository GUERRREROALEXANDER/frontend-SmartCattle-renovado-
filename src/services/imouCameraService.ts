import { dataMode } from '../api/config'
import { ApiError } from '../api/errors'
import { getJson, postJson } from '../api/httpClient'
import type { ServiceOptions } from './options'

// Imou cameras open through Imou's own cloud by their serial number, so they work wherever the server runs: nobody
// types an IP address, and nothing has to stay switched on at the farm. The backend knows which cameras the
// SmartCattle Imou account can show; connecting one saves it to this account and the AI service opens it by itself.

export const IMOU_PREFIX = 'imou:'
export const isImouCamera = (source: string) => source.startsWith(IMOU_PREFIX)

export interface ImouCamera {
  serial: string
  name: string
  model: string | null
  /** Whether Imou's cloud sees it switched on right now. */
  online: boolean
  /** Its saved camera in this account, when it is already connected. */
  cameraId: string | null
}

export interface ImouCameras {
  /** False when the server has no Imou account set up, or could not reach Imou. */
  available: boolean
  cameras: ImouCamera[]
}

function toImouCamera(value: unknown): ImouCamera[] {
  const item = value as { serial?: unknown; name?: unknown; model?: unknown; online?: unknown; camera_id?: unknown } | null
  if (!item || typeof item.serial !== 'string' || !item.serial) return []
  return [{
    serial: item.serial,
    name: typeof item.name === 'string' && item.name ? item.name : `Imou ${item.serial.slice(-4)}`,
    model: typeof item.model === 'string' ? item.model : null,
    online: item.online === true,
    cameraId: typeof item.camera_id === 'string' ? item.camera_id : null,
  }]
}

/** The Imou cameras this account can connect or already did. Never throws: the page shows the card either way. */
export async function listImouCameras(options: ServiceOptions = {}): Promise<ImouCameras> {
  if ((options.mode ?? dataMode) === 'mock') return { available: false, cameras: [] }
  try {
    const body = await getJson<{ available?: unknown; items?: unknown }>('/api/cameras/suggestions', options)
    return { available: body.available === true, cameras: (Array.isArray(body.items) ? body.items : []).flatMap(toImouCamera) }
  } catch {
    return { available: false, cameras: [] }
  }
}

/** Saves the camera to this account. Its video opens by itself a few seconds later, from Imou's cloud. */
export async function connectImouCamera(serial: string, options: ServiceOptions = {}): Promise<{ online: boolean }> {
  const body = await postJson<{ outcome?: unknown; camera?: { status?: unknown } | null; message?: unknown }>(
    '/api/cameras/connect', { serial }, options)
  if (body.outcome !== 'connected') throw new Error('Respuesta de conexión no válida')
  // The backend's sentence says which of the two it was; its wording is not shown to the person.
  return { online: typeof body.message !== 'string' || !/offline/i.test(body.message) }
}

/** What went wrong connecting an Imou camera, in the person's words. */
export function imouProblem(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return /another account/i.test(error.detail ?? '')
      ? 'Esa cámara Imou ya está conectada en otra cuenta.'
      : 'Tu cuenta ya tiene el máximo de cámaras. Quita una antes de agregar otra.'
    if (error.status === 404) return 'La cuenta Imou de SmartCattle ya no ve esa cámara. Compártela otra vez desde la app Imou Life.'
    if (error.status === 403) return 'Solo el dueño de la finca puede conectar cámaras.'
    if (error.status === 502 || error.status === 503) return 'No se pudo hablar con la nube de Imou. Inténtalo de nuevo en un momento.'
    if (error.kind === 'network' || error.kind === 'timeout') return 'No se pudo contactar el servidor. Revisa la conexión e inténtalo de nuevo.'
  }
  return 'No se pudo conectar la cámara Imou. Inténtalo de nuevo.'
}
