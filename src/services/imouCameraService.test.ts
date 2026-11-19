import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import { connectImouCamera, imouProblem, isImouCamera, listImouCameras } from './imouCameraService'

const api = { mode: 'api' as const, baseUrl: 'http://backend.test', token: 'session' }
const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})) as unknown as typeof fetch

describe('imouCameraService', () => {
  it('tells an Imou cloud camera from any other source', () => {
    expect(isImouCamera('imou:04797CEPSF59DA6')).toBe(true)
    expect(isImouCamera('rtsp://192.168.1.20/live')).toBe(false)
    expect(isImouCamera('browser')).toBe(false)
  })

  it('lists the cameras the account can connect and the ones it already did', async () => {
    const fetchImpl = answer({ available: true, items: [
      { serial: '04797CEPSF59DA6', name: 'Potrero Norte', model: 'IPC-S42FP', online: true, camera_id: null },
      { serial: '1A2B3C4D5E6F7G8', name: '', online: false, camera_id: 'cam-1' },
      { name: 'sin serie' },
    ] })
    await expect(listImouCameras({ ...api, fetchImpl })).resolves.toEqual({ available: true, cameras: [
      { serial: '04797CEPSF59DA6', name: 'Potrero Norte', model: 'IPC-S42FP', online: true, cameraId: null },
      { serial: '1A2B3C4D5E6F7G8', name: 'Imou F7G8', model: null, online: false, cameraId: 'cam-1' },
    ] })
  })

  it('shows the card as unavailable instead of failing when the server cannot answer', async () => {
    await expect(listImouCameras({ ...api, fetchImpl: answer({ detail: 'boom' }, 500) })).resolves.toEqual({ available: false, cameras: [] })
    await expect(listImouCameras({ mode: 'mock' })).resolves.toEqual({ available: false, cameras: [] })
  })

  it('connects a camera by its serial number alone, with no address', async () => {
    const fetchImpl = answer({ outcome: 'connected', message: 'Connected. The video opens from the Imou cloud in a few seconds.', camera: { id: 'cam-1' } })
    await expect(connectImouCamera('04797CEPSF59DA6', { ...api, fetchImpl })).resolves.toEqual({ online: true })
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]
    expect(String(url)).toContain('/api/cameras/connect')
    expect(JSON.parse(String(init?.body))).toEqual({ serial: '04797CEPSF59DA6' })
  })

  it('says when Imou sees the connected camera switched off', async () => {
    const fetchImpl = answer({ outcome: 'connected', message: 'Connected. The Imou cloud sees the camera offline: check its power and Wi-Fi.' })
    await expect(connectImouCamera('04797CEPSF59DA6', { ...api, fetchImpl })).resolves.toEqual({ online: false })
  })

  it('explains each refusal in the person\'s words', () => {
    expect(imouProblem(new ApiError('http', 'x', { status: 409, detail: 'This camera is already connected to another account' }))).toMatch(/otra cuenta/)
    expect(imouProblem(new ApiError('http', 'x', { status: 409, detail: 'This account already has too many cameras' }))).toMatch(/máximo/)
    expect(imouProblem(new ApiError('http', 'x', { status: 404 }))).toMatch(/Imou Life/)
    expect(imouProblem(new ApiError('http', 'x', { status: 502 }))).toMatch(/nube de Imou/)
    expect(imouProblem(new ApiError('network', 'x'))).toMatch(/servidor/)
    expect(imouProblem(new Error('otra cosa'))).toMatch(/Inténtalo de nuevo/)
  })
})
