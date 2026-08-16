import { type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({
  label,
  error,
  className = '',
  id,
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-muted">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`bg-surface-2 text-ink placeholder:text-muted border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary ${
          error ? 'border-danger' : 'border-border'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
