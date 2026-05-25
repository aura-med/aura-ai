'use client'

import type { ComponentProps, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Dialog({
  open,
  children,
}: {
  open: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}) {
  if (!open) return null
  return <>{children}</>
}

export function DialogContent({
  className,
  children,
}: ComponentProps<'div'>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div
        className={cn('relative w-full rounded-xl border p-5 shadow-2xl', className)}
        role="dialog"
        aria-modal="true"
        style={{ background: 'var(--aura-bg2)', borderColor: 'var(--aura-border)', color: 'var(--aura-text)' }}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('space-y-1.5 pr-8', className)} {...props} />
}

export function DialogTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-lg font-semibold', className)} style={{ fontFamily: 'var(--font-syne)' }} {...props} />
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end', className)} style={{ borderColor: 'var(--aura-border)' }} {...props} />
}

export function DialogClose({ className, ...props }: ComponentProps<'button'>) {
  return (
    <button
      className={cn('absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md hover:bg-[var(--aura-bg3)]', className)}
      type="button"
      {...props}
    >
      <X size={15} />
      <span className="sr-only">Close</span>
    </button>
  )
}
