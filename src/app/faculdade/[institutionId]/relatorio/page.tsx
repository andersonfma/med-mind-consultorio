import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE } from '@/lib/routes'
import { managedInstitutions } from '@/lib/faculty/access'
import { loadFacultyDashboard } from '@/lib/faculty/data'
import { FORMATION_BANDS } from '@/lib/faculty/formation'
import { PrintOnLoad } from './PrintOnLoad'
import { BRAND } from '@/lib/brand'

export const dynamic = 'force-dynamic'

export default async function FacultyReportPage({ params }: { params: Promise<{ institutionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const { institutionId } = await params
  const { institutions } = await managedInstitutions(user.id, user.email)
  const institution = institutions.find((i) => i.id === institutionId)
  if (!institution) notFound()

  const d = await loadFacultyDashboard(institution, Date.now())
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <main className="mx-auto max-w-[800px] bg-white px-10 py-8 text-[13px] text-neutral-900">
      <PrintOnLoad />
      <style>{`@media print { @page { margin: 16mm; } .no-print { display: none !important; } }`}</style>

      <header className="mb-6 border-b-2 border-neutral-900 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{BRAND.name} · Relatório de desempenho</p>
        <h1 className="mt-1 text-2xl font-bold">{institution.name}</h1>
        <p className="mt-0.5 text-neutral-600">{hoje} · {d.totalStudents} alunos · {d.turmas.filter((t) => !t.isUnknown).length} turmas com período</p>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-700">Índice de formação</h2>
        <div className="flex items-end gap-6">
          <div>
            <p className="text-4xl font-bold tabular-nums">{d.index ?? '—'}<span className="text-base font-normal text-neutral-500">/100</span></p>
            <p className="text-xs text-neutral-600">{d.benchmarkPercentile != null ? `Acima de ${d.benchmarkPercentile}% dos alunos da plataforma` : 'Benchmark indisponível'}</p>
          </div>
          <div className="flex-1">
            <table className="w-full text-xs">
              <tbody>
                {d.bandDistribution.map((b) => (
                  <tr key={b.key}>
                    <td className="py-0.5 pr-3 text-neutral-700">{b.label}</td>
                    <td className="py-0.5 text-right font-semibold tabular-nums">{b.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-neutral-400">Benchmark nacional-proxy: distribuição da plataforma ({d.platformIndexN} alunos). Faixas oficiais do ENAMED substituem esta referência quando disponíveis.</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-700">Comportamento</h2>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { l: 'Ativos (7d)', v: d.behavior.activeDays7 },
            { l: 'Em risco', v: d.behavior.atRisk },
            { l: 'Conclusão', v: `${d.behavior.completion}%` },
            { l: 'Pico', v: d.behavior.study.peakBlock },
          ].map((s) => (
            <div key={s.l} className="rounded border border-neutral-300 p-2">
              <p className="text-lg font-bold tabular-nums">{s.v}</p>
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-700">Desempenho por período</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-neutral-400 text-left text-neutral-600">
              <th className="py-1 pr-2 font-semibold">Período</th>
              <th className="py-1 text-right font-semibold">Alunos</th>
              <th className="py-1 text-right font-semibold">Índice</th>
              <th className="py-1 text-right font-semibold">Raciocínio</th>
              <th className="py-1 text-right font-semibold">Comunic.</th>
              <th className="py-1 text-right font-semibold">Conclusão</th>
              <th className="py-1 text-right font-semibold">Risco</th>
            </tr>
          </thead>
          <tbody>
            {d.turmas.map((t) => (
              <tr key={t.periodo} className="border-b border-neutral-200">
                <td className="py-1 pr-2">{t.periodo}</td>
                <td className="py-1 text-right tabular-nums">{t.n}</td>
                <td className="py-1 text-right font-semibold tabular-nums">{t.index ?? '—'}</td>
                <td className="py-1 text-right tabular-nums">{t.ab4 != null ? t.ab4.toFixed(1) : '—'}</td>
                <td className="py-1 text-right tabular-nums">{t.comunicacao != null ? t.comunicacao.toFixed(1) : '—'}</td>
                <td className="py-1 text-right tabular-nums">{t.completion}%</td>
                <td className="py-1 text-right tabular-nums">{t.atRisk}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {d.atRiskStudents.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-700">Alunos em risco</h2>
          <ul className="text-xs">
            {d.atRiskStudents.slice(0, 20).map((r) => (
              <li key={r.id} className="flex justify-between border-b border-neutral-200 py-1">
                <span>{r.name}{r.periodo ? ` · ${r.periodo}` : ''}</span>
                <span className="text-neutral-500">{r.recency == null ? 'nunca usou' : `há ${r.recency} dias`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-8 border-t border-neutral-300 pt-2 text-[10px] text-neutral-400">
        Gerado automaticamente pela plataforma {BRAND.name}. Dados agregados para fins pedagógicos e de gestão acadêmica.
      </footer>
    </main>
  )
}
