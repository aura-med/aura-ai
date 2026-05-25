import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'secondary'
type ButtonSize = 'default' | 'sm' | 'icon' | 'icon-sm'

const variantClass: Record<ButtonVariant, string> = {
  default: 'border-transparent bg-[var(--aura-green)] text-[var(--aura-bg)] hover:opacity-85',
  outline: 'border-[var(--aura-border2)] bg-transparent text-[var(--aura-text2)] hover:bg-[var(--aura-bg3)] hover:text-[var(--aura-text)]',
  ghost: 'border-transparent bg-transparent text-[var(--aura-text2)] hover:bg-[var(--aura-bg3)] hover:text-[var(--aura-text)]',
  secondary: 'border-transparent bg-[var(--aura-bg3)] text-[var(--aura-text)] hover:opacity-85',
}

const sizeClass: Record<ButtonSize, string> = {
  default: 'min-h-10 px-3 text-sm',
  sm: 'min-h-8 px-2.5 text-xs',
  icon: 'size-9 p-0',
  'icon-sm': 'size-8 p-0',
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}) {
  return (
    <button
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      type={type}
      {...props}
    />
  )
}
