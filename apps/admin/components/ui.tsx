import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('rounded-xl border p-4', className)}
      style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)' }}
    >
      {children}
    </section>
  )
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1
          className="text-xl font-semibold"
          style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}
        >
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--aura-text3)' }}>
          {description}
        </p>
      </div>
      {action}
    </div>
  )
}

export function Kpi({
  label,
  value,
  sub,
  tone = 'green',
}: {
  label: string
  value: string | number
  sub?: string
  tone?: 'green' | 'blue' | 'warn' | 'danger' | 'purple'
}) {
  const color = {
    green: 'var(--aura-green)',
    blue: 'var(--aura-blue)',
    warn: 'var(--aura-warn)',
    danger: 'var(--aura-danger)',
    purple: 'var(--aura-purple)',
  }[tone]

  return (
    <div className="rounded-lg border p-4" style={{ background: 'var(--aura-bg3)', borderColor: 'var(--aura-border)' }}>
      <div className="text-[11px]" style={{ color: 'var(--aura-text3)' }}>
        {label}
      </div>
      <div
        className="mt-2 text-3xl font-black leading-none"
        style={{ color, fontFamily: 'var(--font-syne)' }}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-2 text-[10px]" style={{ color: 'var(--aura-text3)', fontFamily: 'var(--font-dm-mono)' }}>
          {sub}
        </div>
      ) : null}
    </div>
  )
}

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'green' | 'blue' | 'warn' | 'danger' | 'purple' | 'neutral'
}) {
  const styles = {
    green: { background: 'var(--aura-green-bg)', color: 'var(--aura-green)' },
    blue: { background: 'var(--aura-blue-bg)', color: 'var(--aura-blue)' },
    warn: { background: 'var(--aura-warn-bg)', color: 'var(--aura-warn)' },
    danger: { background: 'var(--aura-danger-bg)', color: 'var(--aura-danger)' },
    purple: { background: 'var(--aura-purple-bg)', color: 'var(--aura-purple)' },
    neutral: { background: 'rgba(255,255,255,0.08)', color: 'var(--aura-text2)' },
  }[tone]

  return (
    <span
      className="inline-flex min-h-6 items-center rounded-full px-2 text-[11px] font-semibold"
      style={{ ...styles, fontFamily: 'var(--font-dm-mono)' }}
    >
      {children}
    </span>
  )
}

export function SubmitButton({
  children,
  tone = 'green',
  className,
}: {
  children: ReactNode
  tone?: 'green' | 'danger' | 'neutral'
  className?: string
}) {
  const styles = {
    green: { background: 'var(--aura-green)', color: 'var(--aura-bg)' },
    danger: { background: 'var(--aura-danger)', color: '#fff' },
    neutral: { background: 'var(--aura-bg3)', color: 'var(--aura-text)' },
  }[tone]

  return (
    <button
      className={cn('inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-opacity hover:opacity-85', className)}
      style={styles}
      type="submit"
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium" style={{ color: 'var(--aura-text2)' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

export const inputClassName =
  'min-h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-1'

export const inputStyle = {
  background: 'var(--aura-bg3)',
  borderColor: 'var(--aura-border2)',
  color: 'var(--aura-text)',
}
