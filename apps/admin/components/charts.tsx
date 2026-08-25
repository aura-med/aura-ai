'use client'

import dynamic from 'next/dynamic'

export type MiniChartProps = {
  data: Array<Record<string, string | number>>
  dataKey: string
}

function ChartSkeleton() {
  return <div className="h-56 rounded-lg animate-pulse" style={{ background: 'var(--sophi-bg3)' }} />
}

export const MiniLineChart = dynamic(
  () => import('./charts-recharts').then((mod) => mod.MiniLineChartImpl),
  { loading: () => <ChartSkeleton /> }
)

export const MiniBarChart = dynamic(
  () => import('./charts-recharts').then((mod) => mod.MiniBarChartImpl),
  { loading: () => <ChartSkeleton /> }
)
