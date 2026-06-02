'use client'

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MiniChartProps } from './charts'

export function MiniLineChartImpl({
  data,
  dataKey,
}: MiniChartProps) {
  return (
    <div className="h-56">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" stroke="var(--aura-text3)" tick={{ fontSize: 11 }} />
          <YAxis stroke="var(--aura-text3)" tick={{ fontSize: 11 }} width={28} />
          <Tooltip
            contentStyle={{
              background: 'var(--aura-bg2)',
              border: '1px solid var(--aura-border2)',
              borderRadius: 8,
              color: 'var(--aura-text)',
            }}
          />
          <Line dataKey={dataKey} dot={false} stroke="var(--aura-green)" strokeWidth={2} type="monotone" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MiniBarChartImpl({
  data,
  dataKey,
}: MiniChartProps) {
  return (
    <div className="h-56">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" stroke="var(--aura-text3)" tick={{ fontSize: 11 }} />
          <YAxis stroke="var(--aura-text3)" tick={{ fontSize: 11 }} width={28} />
          <Tooltip
            contentStyle={{
              background: 'var(--aura-bg2)',
              border: '1px solid var(--aura-border2)',
              borderRadius: 8,
              color: 'var(--aura-text)',
            }}
          />
          <Bar dataKey={dataKey} fill="var(--aura-blue)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
