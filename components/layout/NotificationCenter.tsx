'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, X, CheckCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  getNotifications,
  markAllAsRead,
  getNotificationIcon,
  getNotificationColor,
} from '@/lib/notifications'
import type { Notification } from '@/lib/notifications'

export function NotificationCenter({ orgId }: { orgId?: string }) {
  const t = useTranslations('notifications')
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read_by?.length).length

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    getNotifications(orgId)
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgId, open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function formatTime(dateStr: string): string {
    try {
      const date = new Date(dateStr)
      const diff = Date.now() - date.getTime()
      const minutes = Math.floor(diff / 60000)
      if (minutes < 1) return 'agora'
      if (minutes < 60) return `${minutes}m`
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return `${hours}h`
      const days = Math.floor(hours / 24)
      return `${days}d`
    } catch {
      return ''
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md transition-colors"
        style={{ color: open ? 'var(--aura-text)' : 'var(--aura-text2)' }}
        aria-label={t('title')}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[8px] h-2 rounded-full text-[9px] flex items-center justify-center font-bold"
            style={{ background: 'var(--aura-danger)', color: 'white' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount > 1 ? String(unreadCount) : ''}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-xl border shadow-2xl z-50 overflow-hidden"
          style={{
            background: 'var(--aura-bg2)',
            borderColor: 'var(--aura-border)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--aura-border)' }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--aura-text)', fontFamily: 'var(--font-syne)' }}
            >
              {t('title')}
              {unreadCount > 0 && (
                <span
                  className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-mono"
                  style={{ background: 'var(--aura-danger)', color: 'white' }}
                >
                  {unreadCount}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() =>
                    markAllAsRead(orgId ?? '', '').then(() =>
                      setNotifications((prev) =>
                        prev.map((n) => ({ ...n, read_by: ['me'] }))
                      )
                    )
                  }
                  className="text-xs flex items-center gap-1 transition-colors"
                  style={{ color: 'var(--aura-text3)' }}
                  title={t('markAllRead')}
                >
                  <CheckCheck size={13} />
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ color: 'var(--aura-text3)' }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-xs" style={{ color: 'var(--aura-text3)' }}>
                {t('loading')}
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center" style={{ color: 'var(--aura-text3)' }}>
                <Bell size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">{t('empty')}</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isRead = n.read_by?.length > 0
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex gap-3 px-4 py-3 border-b transition-colors cursor-pointer hover:bg-white/5',
                      !isRead && 'bg-white/[0.02]'
                    )}
                    style={{ borderColor: 'var(--aura-border)' }}
                  >
                    <div className="mt-0.5 w-5 shrink-0 text-center text-base">
                      {getNotificationIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn('text-xs leading-snug', !isRead && 'font-semibold')}
                          style={{ color: 'var(--aura-text)' }}
                        >
                          {n.title}
                        </p>
                        <span
                          className="text-[10px] shrink-0 font-mono"
                          style={{ color: 'var(--aura-text3)' }}
                        >
                          {formatTime(n.created_at)}
                        </span>
                      </div>
                      {n.body && (
                        <p
                          className="text-[11px] mt-0.5 leading-snug"
                          style={{ color: 'var(--aura-text3)' }}
                        >
                          {n.body}
                        </p>
                      )}
                      <div
                        className="mt-1.5 h-0.5 w-8 rounded-full"
                        style={{ background: getNotificationColor(n.type), opacity: 0.7 }}
                      />
                    </div>
                    {!isRead && (
                      <div
                        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: 'var(--aura-blue)' }}
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--aura-border)' }}>
              <p
                className="text-[10px] text-center font-mono"
                style={{ color: 'var(--aura-text3)' }}
              >
                {t('last50')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
