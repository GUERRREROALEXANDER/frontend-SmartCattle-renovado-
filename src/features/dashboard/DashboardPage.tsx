import { lazy, Suspense } from 'react'
import { useReducedMotion } from 'motion/react'
import { useAuth } from '../../app/auth/useAuth'
import { dataMode } from '../../api/config'
import { Notice, Skeleton } from '../../components/ui'
import { can } from '../../lib/permissions'
import { herdCount } from '../../live/liveState'
import { useLive } from '../../live/useLive'
import { useNow } from '../../lib/useNow'
import type { ResourceState } from '../../lib/useResource'
import { hasPicture, type HerdCount } from '../../services'
import { FadeUp, staggerDelay } from '../../motion'
import type { FarmEvent } from '../../types/domain'
import { AlertCenter } from './AlertCenter'
import { DailyReportCard } from './DailyReportCard'
import { farmCondition, statusHeadline } from './dashboardModel'
import { FarmStatusHeader } from './FarmStatusHeader'
import { FieldLog } from './FieldLog'
import { HerdSummary } from './HerdSummary'
import { ImouWelcomeCard } from './ImouWelcomeCard'
import { LiveMonitor } from './LiveMonitor'
import { useDashboardData } from './useDashboardData'
import styles from './DashboardPage.module.css'

// It draws with recharts, the heaviest dependency of this page: loaded after the first paint, like the live charts.
const WeekOverview = lazy(async () => ({ default: (await import('./WeekOverview')).WeekOverview }))

const areas = { metrics: styles.metrics, plan: styles.plan, trend: styles.trend, alerts: styles.chart }

export function DashboardPage() {
  const { session } = useAuth()
  const live = useLive()
  const data = useDashboardData(live.cameras.map(camera => camera.id))
  const now = useNow()
  const reduceMotion = useReducedMotion() === true
  const offline = live.connection === 'offline'
  const known = live.updatedAt !== null && !offline
  const open = live.alerts.filter(alert => alert.status === 'open')
  // Stale or missing data cannot prove the farm is calm.
  const condition = farmCondition(open, known)
  const videoIds = data.snapshots.data
    ? new Set(Object.entries(data.snapshots.data).filter(([, snapshot]) => hasPicture(snapshot.stream)).map(([id]) => id))
    : undefined
  const events: ResourceState<FarmEvent[]> & { reload: () => void } = live.updatedAt
    ? { status: 'success', data: live.events, source: dataMode === 'mock' ? 'mock' : 'api', error: null, reload: live.refresh }
    : { status: 'loading', data: null, source: null, error: null, reload: live.refresh }

  const canConfigureCameras = session !== null && can(session.user.role, 'cameras:configure')
  const noCamerasYet = canConfigureCameras && live.updatedAt !== null && live.cameras.length === 0

  // The detected count is the same live number the tiles and the plan show, never a separate poll.
  const count = herdCount(live)
  const detected: ResourceState<HerdCount | null> = live.updatedAt
    ? { status: 'success', data: count && { count: count.total, countedAt: live.updatedAt }, source: events.source ?? 'api', error: null }
    : { status: 'loading', data: null, source: null, error: null }

  return <div className={styles.page}>
    <FadeUp>
      <FarmStatusHeader
        farmName={data.farm.data?.name ?? null}
        condition={condition}
        headline={live.updatedAt || offline ? statusHeadline(condition, open.length) : null}
        status={data.status.data ?? null}
        cameras={live.updatedAt ? live.cameras : null}
        withVideo={videoIds ? videoIds.size : null}
        updatedAt={live.updatedAt} />
    </FadeUp>

    {offline && <FadeUp delay={staggerDelay(1)} className={styles.alerts}>
      <Notice tone="critical" title="Sin conexión con el servidor">
        Se muestra la última información recibida. Se reintenta automáticamente.
      </Notice>
    </FadeUp>}

    <FadeUp delay={staggerDelay(1)} className={styles.alerts}>
      <ImouWelcomeCard show={noCamerasYet} />
    </FadeUp>

    <div className={styles.grid}>
      <LiveMonitor stale={offline} withVideo={videoIds} reduceMotion={reduceMotion} areas={areas} />
      <Suspense fallback={<Skeleton className={styles.overview} height="24rem" radius="var(--radius-lg)" />}>
        <WeekOverview className={styles.overview} delay={staggerDelay(4)} cameras={live.updatedAt ? live.cameras : null} />
      </Suspense>
      <AlertCenter className={styles.alertCenter} delay={staggerDelay(6)} alerts={live.alerts} cameras={live.cameras}
        now={now} onAction={live.updateAlert} reduceMotion={reduceMotion} />
      <HerdSummary card className={styles.herd} delay={staggerDelay(9)}
        registered={data.registered} detected={detected} stale={offline} />
      <DailyReportCard className={styles.report} delay={staggerDelay(10)} />
      <FieldLog className={styles.log} delay={staggerDelay(11)}
        events={events} cameras={live.cameras} securityHours={data.securityHours.data ?? null} now={now} />
    </div>
  </div>
}
