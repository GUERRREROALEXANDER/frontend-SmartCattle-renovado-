import { Loader2 } from 'lucide-react'
import { Navigate, Outlet } from 'react-router'
import { useResource } from '../../lib/useResource'
import { getCurrentFarm } from '../../services'
import styles from './RequireAuth.module.css'

/**
 * What a signed-in person sees first is Inicio. An account with nothing registered yet is asked once whether it has
 * a farm or a single lot; cameras are never a gate, they are connected from their own page whenever the person wants.
 * If the backend can't be reached the app still opens: each page already explains what is missing.
 */
export function RequireFarm() {
  const farm = useResource(signal => getCurrentFarm({ signal }))
  if (farm.status === 'loading') return <div className={styles.loading} role="status">
    <Loader2 className={styles.spinner} aria-hidden="true" />
    <span className="visually-hidden">Cargando la finca</span>
  </div>
  if (farm.status === 'success' && farm.data === null) return <Navigate to="/setup" replace />
  return <Outlet />
}
