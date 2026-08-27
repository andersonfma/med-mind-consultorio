import { MedMindMark } from '@/components/layout/MedMindMark'
import { MedMindStripes } from '@/components/layout/MedMindStripes'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

// Sempre-fresca: evita o cache longo (s-maxage=1 ano) das páginas estáticas,
// para que correções de UI apareçam sem precisar furar cache.
export const dynamic = 'force-dynamic'

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
          <MedMindMark className="h-14 w-14 rounded-xl shadow-[var(--shadow-glow-primary)]" />
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">
            Med<span className="text-primary">Mind</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Simulador clínico</p>
        </div>
        {children}
      </div>
    </div>
  )
}
