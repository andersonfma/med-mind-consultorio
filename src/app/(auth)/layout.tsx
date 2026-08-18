import { MedMindMark } from '@/components/layout/MedMindMark'
import { MedMindColonnade } from '@/components/layout/MedMindColonnade'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 overflow-hidden">
      <MedMindColonnade opacity={0.13} />
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <MedMindMark className="h-16 w-16 rounded-2xl shadow-[var(--shadow-glow-primary)]" />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-ink">
            Med<span className="text-primary">Mind</span>
          </h1>
          <p className="text-sm text-muted mt-1">Simulador clínico</p>
        </div>
        {children}
      </div>
    </div>
  )
}
