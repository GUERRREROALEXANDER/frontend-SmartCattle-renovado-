import { dataMode } from '../api/config'
import { deleteJson, getJson, putJson } from '../api/httpClient'
import type { ServiceOptions } from './options'

// The cover page's video ("Video Inicio"). Apart from the analysed recordings and the live cameras:
// it is one address for the whole site, read without a session.

export interface VideoInicio {
  url: string
  title: string | null
  posterUrl: string | null
  updatedAt: Date | null
  /** 'panel' when an administrator chose it, 'deployment' when it is the server's default. */
  source: 'panel' | 'deployment'
}

export interface VideoInicioInput { url: string; title?: string; posterUrl?: string }

interface VideoInicioDto { url?: unknown; title?: unknown; poster_url?: unknown; updated_at?: unknown; source?: unknown }

const PATH = '/api/video-inicio'
const VIDEO_PATTERN = /\.(mp4|webm)(\?.*)?$/i

function parseVideo(body: unknown): VideoInicio | null {
  const video = (body as { video?: VideoInicioDto | null } | null)?.video
  if (!video || typeof video.url !== 'string' || !VIDEO_PATTERN.test(video.url)) return null
  // Only what a page may load: https, or a file published with the site.
  if (!/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/]|\/(?!\/))/.test(video.url)) return null
  const updated = typeof video.updated_at === 'string' ? new Date(video.updated_at) : null
  return {
    url: video.url,
    title: typeof video.title === 'string' ? video.title : null,
    posterUrl: typeof video.poster_url === 'string' ? video.poster_url : null,
    updatedAt: updated && !Number.isNaN(updated.getTime()) ? updated : null,
    source: video.source === 'deployment' ? 'deployment' : 'panel',
  }
}

/** The cover's video, or null when the cover should show its own 3D scene. Never throws: a cover must always open. */
export async function getVideoInicio(options: ServiceOptions = {}): Promise<VideoInicio | null> {
  if ((options.mode ?? dataMode) === 'mock') return null
  try {
    return parseVideo(await getJson<unknown>(PATH, { signal: options.signal, token: null, timeoutMs: 6000 }))
  } catch {
    return null
  }
}

export async function canEditVideoInicio(options: ServiceOptions = {}): Promise<boolean> {
  if ((options.mode ?? dataMode) === 'mock') return false
  try {
    const body = await getJson<{ can_edit?: unknown }>(`${PATH}/permiso`, { signal: options.signal })
    return body.can_edit === true
  } catch {
    return false
  }
}

export async function saveVideoInicio(input: VideoInicioInput): Promise<VideoInicio | null> {
  return parseVideo(await putJson<unknown>(PATH, {
    url: input.url.trim(), title: input.title?.trim() || null, poster_url: input.posterUrl?.trim() || null,
  }))
}

export async function removeVideoInicio(): Promise<void> {
  await deleteJson<unknown>(PATH)
}
