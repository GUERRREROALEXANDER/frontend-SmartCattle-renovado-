import { useMemo, useState, type RefObject } from 'react'
import { Html } from '@react-three/drei'
import { Cctv, MapPin, OctagonAlert, UserRound, X } from 'lucide-react'
import type { ZoneSummary } from '../../../live/herdSummary'
import type { CameraStatus } from '../../../types/domain'
import { heightAt } from '../kit/terrain/heightfield'
import { polygonInteriorPoint } from '../simulation/geometry'
import type { SceneLot } from './sceneLots'
import styles from './LotMarkers.module.css'

const Z_INDEX_RANGE = [12, 0]
const STATUS_TEXT: Record<CameraStatus, string> = {
  online: 'En línea', connecting: 'Conectando', offline: 'Sin conexión', error: 'Con error',
}

export interface LotMarkersProps {
  lots: readonly SceneLot[]
  zones: readonly ZoneSummary[]
  /** Camera that watches each lot, when it has one. */
  lotCameras: ReadonlyMap<string, { name: string; status: CameraStatus }>
  portal: RefObject<HTMLElement>
  onFocus?: (lotId: string) => void
}

/** A floating pin over every lot. Pressing one opens what the cameras count there right now. */
export function LotMarkers({ lots, zones, lotCameras, portal, onFocus }: LotMarkersProps) {
  const [open, setOpen] = useState<string | null>(null)
  const byLot = useMemo(() => new Map(zones.map(zone => [zone.lotId, zone])), [zones])
  const anchors = useMemo(() => lots.map(lot => {
    const center = polygonInteriorPoint(lot.boundary)
    return { lot, position: [center.x, heightAt(center.x, center.z) + 4.2, center.z] as [number, number, number] }
  }), [lots])

  return (
    <>
      {anchors.map(({ lot, position }) => {
        const zone = byLot.get(lot.id)
        const camera = lotCameras.get(lot.id)
        const expanded = open === lot.id
        const breached = zone?.breached === true
        return (
          <Html key={lot.id} portal={portal} position={position} center zIndexRange={Z_INDEX_RANGE} pointerEvents="auto">
            <div className={styles.marker} data-open={expanded} data-breached={breached}>
              <button type="button" className={styles.pin} aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : lot.id)}>
                {breached
                  ? <OctagonAlert size={15} strokeWidth={2.2} aria-hidden="true" />
                  : <MapPin size={15} strokeWidth={2.2} aria-hidden="true" />}
                <span>{lot.name}</span>
                {zone?.watched && <strong className="tabular">{zone.total}</strong>}
              </button>
              {expanded && (
                <div className={styles.card} role="dialog" aria-label={`Métricas de ${lot.name}`}>
                  <header className={styles.cardHead}>
                    <span>{lot.name}</span>
                    <button type="button" className={styles.close} aria-label="Cerrar" onClick={() => setOpen(null)}>
                      <X size={14} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  </header>
                  {zone?.watched ? (
                    <dl className={styles.stats}>
                      <div><dt>Dentro</dt><dd className="tabular" data-tone="safe">{zone.inside}</dd></div>
                      <div><dt>Fuera</dt><dd className="tabular" data-tone={zone.outside > 0 ? 'alert' : undefined}>{zone.outside}</dd></div>
                      <div><dt>Personas</dt><dd className="tabular" data-tone={zone.people > 0 ? 'warning' : undefined}>{zone.people}</dd></div>
                    </dl>
                  ) : (
                    <p className={styles.note}>Este lote no tiene cámara: su conteo se desconoce, no es cero.</p>
                  )}
                  {camera && (
                    <p className={styles.camera} data-status={camera.status}>
                      <Cctv size={14} strokeWidth={2} aria-hidden="true" />{camera.name} · {STATUS_TEXT[camera.status]}
                    </p>
                  )}
                  {zone && zone.people > 0 && (
                    <p className={styles.camera} data-status="connecting">
                      <UserRound size={14} strokeWidth={2} aria-hidden="true" />Persona detectada en el lote
                    </p>
                  )}
                  {onFocus && (
                    <button type="button" className={styles.focus} onClick={() => { onFocus(lot.id); setOpen(null) }}>
                      Acercar la cámara
                    </button>
                  )}
                </div>
              )}
            </div>
          </Html>
        )
      })}
    </>
  )
}
