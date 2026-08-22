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
      style={{ background: 'var(--sophi-bg2)', borderColor: 'var(--sophi-border)' }}
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
          style={{ color: 'var(--sophi-text)', fontFamily: 'var(--font-syne)' }}
        >
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--sophi-text3)' }}>
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
    green: 'var(--sophi-green)',
    blue: 'var(--sophi-blue)',
    warn: 'var(--sophi-warn)',
    danger: 'var(--sophi-danger)',
    purple: 'var(--sophi-purple)',
  }[tone]

  return (
    <div className="rounded-lg border p-4" style={{ background: 'var(--sophi-bg3)', borderColor: 'var(--sophi-border)' }}>
      <div className="text-[11px]" style={{ color: 'var(--sophi-text3)' }}>
        {label}
      </div>
      <div
        className="mt-2 text-3xl font-black leading-none"
        style={{ color, fontFamily: 'var(--font-syne)' }}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-2 text-[10px]" style={{ color: 'var(--sophi-text3)', fontFamily: 'var(--font-dm-mono)' }}>
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
    green: { background: 'var(--sophi-green-bg)', color: 'var(--sophi-green)' },
    blue: { background: 'var(--sophi-blue-bg)', color: 'var(--sophi-blue)' },
    warn: { background: 'var(--sophi-warn-bg)', color: 'var(--sophi-warn)' },
    danger: { background: 'var(--sophi-danger-bg)', color: 'var(--sophi-danger)' },
    purple: { background: 'var(--sophi-purple-bg)', color: 'var(--sophi-purple)' },
    neutral: { background: 'rgba(255,255,255,0.08)', color: 'var(--sophi-text2)' },
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
    green: { background: 'var(--sophi-green)', color: 'var(--sophi-bg)' },
    danger: { background: 'var(--sophi-danger)', color: '#fff' },
    neutral: { background: 'var(--sophi-bg3)', color: 'var(--sophi-text)' },
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
      <span className="text-xs font-medium" style={{ color: 'var(--sophi-text2)' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

export const inputClassName =
  'min-h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-1'

export const inputStyle = {
  background: 'var(--sophi-bg3)',
  borderColor: 'var(--sophi-border2)',
  color: 'var(--sophi-text)',
}

// ── Feedback banner ──────────────────────────────────────────────────────────

interface FeedbackBannerProps {
  success?: string
  error?: string
}

export function FeedbackBanner({ success, error }: FeedbackBannerProps) {
  if (!success && !error) return null
  const tone = error ? 'danger' : 'green'
  const msg = error ?? success ?? ''
  const colors: Record<string, { bg: string; border: string; color: string }> = {
    danger: { bg: 'var(--sophi-danger-bg)', border: 'rgba(255,77,109,0.28)', color: 'var(--sophi-danger)' },
    green:  { bg: 'var(--sophi-green-bg)',  border: 'rgba(0,229,160,0.28)',  color: 'var(--sophi-green)' },
  }
  const c = colors[tone]
  return (
    <div
      className="rounded-lg border px-4 py-3 text-sm"
      style={{ background: c.bg, borderColor: c.border, color: c.color }}
    >
      {msg}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  message: string
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <tr>
      <td colSpan={99} className="py-12 text-center text-sm" style={{ color: 'var(--sophi-text3)' }}>
        {message}
      </td>
    </tr>
  )
}
