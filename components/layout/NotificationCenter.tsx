'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Bell, X, CheckCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { markAllNotificationsRead } from '@/lib/data/actions'
import type { NotificationDTO } from '@/lib/data/types'

const NOTIFICATION_ICONS: Record<string, string> = {
  score_critical: '!',
  score_high: '!',
  injury_new: '+',
  rehab_update: '~',
  checkin_missing: '?',
  rtp_ready: 'OK',
  readiness_drop: '-',
}

function formatTime(dateStr: string, now: number): string {
  const date = new Date(dateStr)
  const diff = now - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function NotificationCenter({
  orgId,
  userId,
  initialNotifications,
}: {
  orgId?: string
  userId: string | null
  initialNotifications: NotificationDTO[]
}) {
  const t = useTranslations('notifications')
  const [open, setOpen] = useState(false)
  const [now] = useState(() => Date.now())
  const [notifications, setNotifications] = useState(initialNotifications)
  const [isPending, startTransition] = useTransition()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const unreadCount = notifications.filter((n) => userId && !n.readBy.includes(userId)).length

  useEffect(() => {
    if (!open) return
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && e.target !== triggerRef.current) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  function handleMarkAllRead() {
    if (!orgId || !userId) return
    startTransition(async () => {
      await markAllNotificationsRead(orgId)
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          readBy: [...new Set([...notification.readBy, userId])],
        }))
      )
    })
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="relative flex size-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aura-green)]"
        style={{ color: open ? 'var(--aura-text)' : 'var(--aura-text2)' }}
        aria-label={`${t('title')}${unreadCount ? `, ${unreadCount} por ler` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={16} aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute right-0.5 top-0.5 min-w-4 rounded-full px-1 text-[10px] font-bold leading-4"
            style={{ background: 'var(--aura-danger)', color: 'white' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label={t('title')}
          className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-0.5rem)] overflow-hidden rounded-lg border shadow-2xl z-50"
          style={{
            background: 'var(--aura-bg2)',
            borderColor: 'var(--aura-border)',
          }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: 'var(--aura-border)' }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}
            >
              {t('title')}
              {unreadCount > 0 && (
                <span
                  className="ml-2 rounded-full px-2 py-0.5 text-xs font-mono"
                  style={{ background: 'var(--aura-danger)', color: 'white' }}
                >
                  {unreadCount}
                </span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={isPending}
                  className="flex size-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aura-green)]"
                  style={{ color: 'var(--aura-text3)' }}
                  aria-label={t('markAllRead')}
                  title={t('markAllRead')}
                >
                  <CheckCheck size={15} aria-hidden="true" />
                </button>
              )}
              <button
                onClick={() => {
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
                className="flex size-9 items-center justify-center rounded-md transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aura-green)]"
                style={{ color: 'var(--aura-text3)' }}
                aria-label="Fechar notificacoes"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto" role="list">
            {notifications.length === 0 ? (
              <div className="py-10 text-center" style={{ color: 'var(--aura-text3)' }}>
                <Bell size={24} className="mx-auto mb-2 opacity-30" aria-hidden="true" />
                <p className="text-xs">{t('empty')}</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isRead = Boolean(userId && n.readBy.includes(userId))
                return (
                  <article
                    key={n.id}
                    role="listitem"
                    className={cn(
                      'flex gap-3 border-b px-4 py-3 transition-colors',
                      !isRead && 'bg-white/[0.02]'
                    )}
                    style={{ borderColor: 'var(--aura-border)' }}
                    aria-label={`${n.title}. ${n.status.ariaLabel}`}
                  >
                    <div
                      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold"
                      style={{
                        color: n.status.key === 'red' ? 'var(--aura-danger)' : n.status.key === 'amber' ? 'var(--aura-warn)' : 'var(--aura-green)',
                        borderColor: 'var(--aura-border2)',
                        fontFamily: 'var(--font-mono)',
                      }}
                      aria-hidden="true"
                    >
                      {NOTIFICATION_ICONS[n.type] ?? 'i'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn('text-xs leading-snug', !isRead && 'font-semibold')}
                          style={{ color: 'var(--aura-text)' }}
                        >
                          {n.title}
                        </p>
                        <span
                          className="shrink-0 text-[10px] font-mono"
                          style={{ color: 'var(--aura-text3)' }}
                        >
                          {formatTime(n.createdAt, now)}
                        </span>
                      </div>
                      {n.body && (
                        <p
                          className="mt-1 text-[11px] leading-snug"
                          style={{ color: 'var(--aura-text2)' }}
                        >
                          {n.body}
                        </p>
                      )}
                      <span
                        className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-mono"
                        style={{
                          color: n.status.key === 'red' ? 'var(--aura-danger)' : n.status.key === 'amber' ? 'var(--aura-warn)' : 'var(--aura-green)',
                          background: 'var(--aura-bg3)',
                        }}
                      >
                        {n.status.label}
                      </span>
                    </div>
                    {!isRead && (
                      <span
                        className="mt-2 size-2 shrink-0 rounded-full"
                        style={{ background: 'var(--aura-blue)' }}
                        aria-label="Por ler"
                      />
                    )}
                  </article>
                )
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t px-4 py-2.5" style={{ borderColor: 'var(--aura-border)' }}>
              <p
                className="text-center text-[10px] font-mono"
                style={{ color: 'var(--aura-text3)' }}
              >
                {t('last50')}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
