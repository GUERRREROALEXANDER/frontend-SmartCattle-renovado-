import { useState, type FormEvent } from 'react'
import { Clapperboard, Trash2 } from 'lucide-react'
import { ApiError } from '../../api/errors'
import { Button, Notice, TextField } from '../../components/ui'
import { useResource } from '../../lib/useResource'
import { getVideoInicio, removeVideoInicio, saveVideoInicio, type VideoInicio } from '../../services/videoInicioService'
import styles from './SettingsPage.module.css'

const VIDEO_PATTERN = /^(https:\/\/\S+|\/[^/\s]\S*)\.(mp4|webm)(\?\S*)?$/i
const ADDRESS_HINT = 'Una dirección https://… o un archivo publicado con el sitio, por ejemplo /video-inicio.mp4. Formatos: .mp4 o .webm.'

function Fields({ saved, onChanged }: { saved: VideoInicio | null; onChanged: (next: VideoInicio | null) => void }) {
  const editable = saved?.source === 'panel' ? saved : null
  const [url, setUrl] = useState(editable?.url ?? '')
  const [title, setTitle] = useState(editable?.title ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    setDone(null)
    const address = url.trim()
    if (!VIDEO_PATTERN.test(address) && !/^http:\/\/(localhost|127\.0\.0\.1)[:/]\S+\.(mp4|webm)(\?\S*)?$/i.test(address)) {
      setError('Escribe una dirección https://… o una ruta que empiece por / y termine en .mp4 o .webm.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      onChanged(await saveVideoInicio({ url: address, title }))
      setDone('Guardado. La portada ya usa este video.')
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 403
        ? 'Tu cuenta no administra el sitio, así que no puede cambiar la portada.'
        : 'No se pudo guardar. Revisa la dirección e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      await removeVideoInicio()
      setUrl('')
      setTitle('')
      onChanged(await getVideoInicio())
      setDone('Listo. La portada vuelve a su escena 3D.')
    } catch {
      setError('No se pudo quitar el video. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return <form className={styles.notifications} onSubmit={event => void save(event)} noValidate>
    <p className={styles.note}>
      {saved === null && 'Ahora la portada muestra el descenso 3D sobre la finca. Si eliges un video, el desplazamiento de la página lo reproduce.'}
      {saved?.source === 'deployment' && 'Ahora la portada usa el video configurado en el servidor. El que guardes aquí lo reemplaza.'}
      {saved?.source === 'panel' && 'La portada usa el video que elegiste aquí.'}
    </p>
    <TextField label="Dirección del video" leadingIcon={Clapperboard} value={url} inputMode="url" autoComplete="off"
      placeholder="/video-inicio.mp4" maxLength={500} hint={ADDRESS_HINT} error={error ?? undefined}
      onChange={event => setUrl(event.target.value)} />
    <TextField label="Título (opcional)" value={title} maxLength={120} autoComplete="off"
      hint="Describe el video para quien usa lector de pantalla."
      onChange={event => setTitle(event.target.value)} />
    <div className={styles.actions}>
      <Button type="submit" loading={busy} disabled={url.trim() === ''}>Guardar video</Button>
      {editable && <Button variant="ghost" icon={Trash2} disabled={busy} onClick={() => void remove()}>Quitar video</Button>}
    </div>
    {done && <Notice tone="safe" title={done} />}
  </form>
}

/** The cover page's video. Apart from the cameras and the analysed recordings: it only decorates the landing page. */
export function VideoInicioForm() {
  const current = useResource(signal => getVideoInicio({ signal }).then(data => ({ data, source: 'api' as const })))
  const [override, setOverride] = useState<{ value: VideoInicio | null } | null>(null)
  if (current.status === 'loading') return null
  const saved = override ? override.value : current.data ?? null
  return <Fields saved={saved} onChanged={value => setOverride({ value })} />
}
