import { MedMindMark } from '@/components/layout/MedMindMark'
import { MedMindStripes } from '@/components/layout/MedMindStripes'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 py-10 overflow-hidden">
      <MedMindStripes />
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="relative z-10 w-full max-w-sm sm:max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <MedMindMark className="h-12 w-12 sm:h-16 sm:w-16 rounded-2xl shadow-[var(--shadow-glow-primary)]" />
          <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Med<span className="text-primary">Mind</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Simulador clínico</p>
        </div>
        {children}
      </div>
    </div>
  )
}
