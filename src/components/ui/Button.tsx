import { type ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'w-full px-4 py-2 rounded-md font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary:
      'bg-primary text-primary-ink hover:bg-primary-hover shadow-[0_6px_24px_-8px_rgba(34,224,230,0.45)]',
    secondary:
      'bg-surface-2 text-ink border border-border hover:bg-surface hover:border-border-strong',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Aguarde...' : children}
    </button>
  )
}
