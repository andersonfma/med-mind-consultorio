import { type ReactNode } from 'react'
import Link from 'next/link'
import { LogoutButton } from './LogoutButton'
import { MedMindMark } from './MedMindMark'
import { MedMindStripes } from './MedMindStripes'
import { ThemeToggle } from './ThemeToggle'

interface ShellProps {
  children: ReactNode
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <MedMindStripes className="mm-fixed mm-static opacity-60" />
      <header className="sticky top-0 z-20 bg-surface/85 backdrop-blur-md border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="group flex items-center gap-3.5">
            <MedMindMark className="h-14 w-14 rounded-xl shadow-[var(--shadow-glow-primary)] transition-transform group-hover:scale-105" />
            <span className="font-display text-3xl font-bold tracking-tight text-ink leading-none">
              Med<span className="text-primary">Mind</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-xs text-muted md:inline">Simulador clínico</span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="relative max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}
