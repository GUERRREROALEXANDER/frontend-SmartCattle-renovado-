import { useMemo, useState } from 'react'
import { ArrowRight, Cctv } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GlassCard, StatusPill } from '../../components/ui'
import { useResource } from '../../lib/useResource'
import { AnimatedNumber, DeltaChip, staggerDelay } from '../../motion'
import { listEvents } from '../../services'
import type { Camera, CameraStatus } from '../../types/domain'
import { buildAnalyticsModel, categoryLabels, previousPeriodDeltas, type AnalyticsRange } from '../analytics/analyticsModel'
import { CategoryDonut } from '../analytics/CategoryDonut'
import { ChartTooltip } from '../analytics/ChartTooltip'
import { axisTick, categoryColors, chartAnimation, chartColors, gridLine, tooltipWrapper, useChartAnimation } from '../analytics/chartTheme'
import styles from './WeekOverview.module.css'

type Period = Extract<AnalyticsRange, '7d' | '30d'>
const PERIODS: readonly { id: Period; label: string; words: string }[] = [
  { id: '7d', label: '7 días', words: 'los últimos 7 días' },
  { id: '30d', label: '30 días', words: 'los últimos 30 días' },
]
const CATEGORIES = ['cattle', 'security', 'system'] as const

const cameraPill: Record<CameraStatus, { tone: 'safe' | 'warning' | 'critical' | 'inactive' | 'info'; label: string }> = {
  online: { tone: 'safe', label: 'En línea' },
  connecting: { tone: 'info', label: 'Conectando' },
  offline: { tone: 'inactive', label: 'Sin conexión' },
  error: { tone: 'critical', label: 'Con error' },
}

/**
 * The farm's recent history at a glance, under the live numbers: how many events each day brought, what kind they
 * were, and which cameras are watching. Everything in it leads somewhere: a bar to the events of that day's kind,
 * a camera to its picture.
 */
export function WeekOverview({ cameras, className, delay = 0 }: {
  cameras: readonly Camera[] | null
  className?: string
  delay?: number
}) {
  const navigate = useNavigate()
  const animate = useChartAnimation()
  const [period, setPeriod] = useState<Period>('7d')
  // Captured when the period is chosen, so the charts do not shift under the pointer between two refreshes.
  const [now, setNow] = useState(() => new Date())
  const events = useResource(signal => listEvents({ signal }), { refreshMs: 60_000 })
  const eventData = events.data
  const cameraList = useMemo(() => cameras ?? [], [cameras])
  const model = useMemo(() => buildAnalyticsModel(eventData ?? [], cameraList, period, now), [eventData, cameraList, period, now])
  const deltas = useMemo(() => previousPeriodDeltas(eventData ?? [], cameraList, period, now), [eventData, cameraList, period, now])
  const words = PERIODS.find(item => item.id === period)!.words
  const total = model.kpis.totalEvents
  const empty = events.data !== null && total === 0
  const online = cameraList.filter(camera => camera.status === 'online').length

  const choose = (next: Period) => {
    setPeriod(next)
    setNow(new Date())
  }

  return <section className={[styles.section, className].filter(Boolean).join(' ')} aria-labelledby="week-overview-title">
    <GlassCard padding="none" delay={delay} className={styles.trend}>
      <header className={styles.head}>
        <div>
          <h2 id="week-overview-title" className={styles.title}>Eventos por día</h2>
          <p className={styles.sub}>Lo que registraron las cámaras en {words}</p>
        </div>
        <div className={styles.tabs} role="group" aria-label="Periodo">
          {PERIODS.map(item => <button key={item.id} type="button" className={styles.tab} aria-pressed={period === item.id}
            onClick={() => choose(item.id)}>{item.label}</button>)}
        </div>
      </header>
      <div className={styles.figure}>
        <p className={styles.total}>
          <AnimatedNumber value={total} />
          <span className={styles.unit}>{total === 1 ? 'evento' : 'eventos'}</span>
          {deltas && <DeltaChip value={deltas.totalEvents} goodWhen="down" />}
        </p>
        <ul className={styles.legend}>
          {CATEGORIES.map(category => <li key={category}>
            <span style={{ backgroundColor: categoryColors[category] }} />{categoryLabels[category]}
          </li>)}
        </ul>
      </div>
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={model.days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={period === '7d' ? '32%' : '18%'}
            onClick={() => navigate('/events')} style={{ cursor: 'pointer' }}>
            <CartesianGrid {...gridLine} />
            <XAxis dataKey="label" minTickGap={18} tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis width={30} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} domain={[0, (max: number) => Math.max(4, max)]} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: chartColors.rule, fillOpacity: 0.35 }} wrapperStyle={tooltipWrapper} />
            {CATEGORIES.map((category, index) => <Bar key={category} dataKey={category} name={categoryLabels[category]} stackId="events"
              fill={categoryColors[category]} radius={index === CATEGORIES.length - 1 ? [5, 5, 0, 0] : 0} maxBarSize={44}
              isAnimationActive={animate} {...chartAnimation} />)}
          </BarChart>
        </ResponsiveContainer>
        {empty && <p className={styles.quiet}>Sin eventos en {words}. Las barras aparecen cuando una cámara registre algo.</p>}
      </div>
      <p className={styles.more}><Link to="/events">Ver todos los eventos<ArrowRight size={14} aria-hidden="true" /></Link></p>
    </GlassCard>

    <GlassCard padding="none" delay={delay + staggerDelay(1)} className={styles.kinds}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>Por tipo</h2>
          <p className={styles.sub}>Ganado, seguridad y sistema</p>
        </div>
      </header>
      {total > 0
        ? <CategoryDonut data={model.categories} />
        : <div className={styles.ring} role="img" aria-label="Sin eventos en el periodo">
          <span><strong>0</strong>eventos</span>
        </div>}
      <p className={styles.more}><Link to="/analytics">Abrir el análisis<ArrowRight size={14} aria-hidden="true" /></Link></p>
    </GlassCard>

    <GlassCard padding="none" delay={delay + staggerDelay(2)} className={styles.cameras}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>Cámaras</h2>
          <p className={styles.sub}>{cameras === null ? 'Cargando…' : cameraList.length === 0 ? 'Ninguna conectada todavía' : `${online} de ${cameraList.length} en línea`}</p>
        </div>
      </header>
      {cameraList.length > 0
        ? <ul className={styles.list}>
          {cameraList.slice(0, 5).map(camera => <li key={camera.id}>
            <Link to="/live" className={styles.row}>
              <span className={styles.rowIcon}><Cctv size={18} strokeWidth={1.9} aria-hidden="true" /></span>
              <span className={styles.rowName}><strong>{camera.name}</strong><span>{camera.location || 'Sin lote asignado'}</span></span>
              <StatusPill {...cameraPill[camera.status]} size="sm" />
            </Link>
          </li>)}
        </ul>
        : <div className={styles.none}>
          <Cctv size={26} strokeWidth={1.6} aria-hidden="true" />
          <p>Conecta tu celular con iVCam o tu cámara Imou para empezar a ver tu ganado.</p>
        </div>}
      <p className={styles.more}><Link to="/cameras">{cameraList.length > 0 ? 'Administrar cámaras' : 'Conectar una cámara'}<ArrowRight size={14} aria-hidden="true" /></Link></p>
    </GlassCard>
  </section>
}
