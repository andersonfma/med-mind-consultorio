import { type ReactNode } from 'react'
import Link from 'next/link'
import { LogoutButton } from './LogoutButton'
import { MedMindMark } from './MedMindMark'

interface ShellProps {
  children: ReactNode
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="group flex items-center gap-2.5">
            <MedMindMark className="h-8 w-8 rounded-lg shadow-[var(--shadow-glow-primary)]" />
            <span className="font-display text-lg font-bold tracking-tight text-ink">
              Med<span className="text-primary">Mind</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-muted sm:inline">Simulador clínico</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
