import { type ReactNode } from 'react'
import Link from 'next/link'
import { LogoutButton } from './LogoutButton'
import { MedMindMark } from './MedMindMark'
import { PillarWatermark } from './PillarWatermark'

interface ShellProps {
  children: ReactNode
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <PillarWatermark />
      <header className="relative z-10 bg-surface/90 backdrop-blur-sm border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="group flex items-center gap-3">
            <MedMindMark className="h-11 w-11 rounded-xl shadow-[var(--shadow-glow-primary)] transition-transform group-hover:scale-105" />
            <span className="font-display text-xl font-bold tracking-tight text-ink">
              Med<span className="text-primary">Mind</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-muted sm:inline">Simulador clínico</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
