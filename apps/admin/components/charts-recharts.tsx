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
          <XAxis dataKey="label" stroke="var(--sophi-text3)" tick={{ fontSize: 11 }} />
          <YAxis stroke="var(--sophi-text3)" tick={{ fontSize: 11 }} width={28} />
          <Tooltip
            contentStyle={{
              background: 'var(--sophi-bg2)',
              border: '1px solid var(--sophi-border2)',
              borderRadius: 8,
              color: 'var(--sophi-text)',
            }}
          />
          <Line dataKey={dataKey} dot={false} stroke="var(--sophi-green)" strokeWidth={2} type="monotone" />
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
          <XAxis dataKey="label" stroke="var(--sophi-text3)" tick={{ fontSize: 11 }} />
          <YAxis stroke="var(--sophi-text3)" tick={{ fontSize: 11 }} width={28} />
          <Tooltip
            contentStyle={{
              background: 'var(--sophi-bg2)',
              border: '1px solid var(--sophi-border2)',
              borderRadius: 8,
              color: 'var(--sophi-text)',
            }}
          />
          <Bar dataKey={dataKey} fill="var(--sophi-blue)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
