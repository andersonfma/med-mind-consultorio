import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE } from '@/lib/routes'
import { managedInstitutions } from '@/lib/faculty/access'
import { loadFacultyDashboard, type StudentRow } from '@/lib/faculty/data'
import { FORMATION_BANDS } from '@/lib/faculty/formation'
import { IndexGauge, TrendLine, WeekdayBars } from '@/components/faculty/FacultyCharts'

export const dynamic = 'force-dynamic'

const toneText: Record<string, string> = { danger: 'text-danger', warning: 'text-warning', 'chart-2': 'text-chart-2', success: 'text-success', primary: 'text-primary' }
const toneBg: Record<string, string> = { danger: 'bg-danger', warning: 'bg-warning', 'chart-2': 'bg-chart-2', success: 'bg-success', primary: 'bg-primary' }

function Panel({ title, children, hint, action }: { title: string; children: ReactNode; hint?: string; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {action ?? (hint && <span className="text-xs text-muted">{hint}</span>)}
      </div>
      {children}
    </section>
  )
}
function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-primary/30 bg-primary/5' : 'border-border bg-surface'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  )
}
function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border pb-1.5 pt-2">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{children}</h2>
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  )
}

export default async function FacultyDashboardPage({ params }: { params: Promise<{ institutionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)
  const { institutionId } = await params

  const { isAdmin, institutions } = await managedInstitutions(user.id, user.email)
  const institution = institutions.find((i) => i.id === institutionId)
  if (!institution) notFound()

  const d = await loadFacultyDashboard(institution, Date.now())
  const peakLabel: Record<string, string> = { madrugada: 'madrugada', manha: 'manhã', tarde: 'tarde', noite: 'noite' }

  const studentLink = (r: StudentRow) =>
    isAdmin ? <Link href={`/admin/${r.id}`} className="font-medium text-ink hover:text-primary">{r.name}</Link>
      : <span className="font-medium text-ink">{r.name}</span>

  return (
    <div className="space-y-6 p-1 sm:p-2">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{institution.name}</h1>
            {isAdmin && <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">pré-visualização do dono</span>}
          </div>
          <p className="text-sm text-muted">{d.totalStudents} alunos · {d.turmas.filter((t) => !t.isUnknown).length} turmas com período</p>
        </div>
        <div className="flex items-center gap-2">
          {institutions.length > 1 && <Link href="/faculdade" className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-primary hover:text-primary">Trocar</Link>}
          <Link href={`/faculdade/${institution.id}/relatorio`} target="_blank"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink hover:opacity-90">Gerar relatório</Link>
        </div>
      </header>

      {/* ───────── ÍNDICE DE FORMAÇÃO ───────── */}
      <SectionTitle hint="valor de graduação vs. média nacional">Índice de formação</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Índice da turma" hint={`${d.withData}/${d.totalStudents} com dados`}>
          <div className="mb-1 flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tabular-nums text-ink">{d.index ?? '—'}</span>
            <span className="text-sm text-muted">/100</span>
          </div>
          <IndexGauge value={d.index} bands={FORMATION_BANDS} benchmark={d.platformMean} />
          <p className="mt-1 text-xs text-muted">
            {d.benchmarkPercentile != null
              ? <>Acima de <span className="font-semibold text-ink">{d.benchmarkPercentile}%</span> dos alunos da plataforma (benchmark nacional-proxy, {d.platformIndexN} alunos).</>
              : 'Benchmark indisponível (sem base suficiente).'}
          </p>
          <p className="mt-1 text-[10px] text-muted/70">Faixas oficiais do ENAMED entram aqui quando disponíveis — hoje a referência é a distribuição da plataforma.</p>
        </Panel>
        <Panel title="Distribuição por faixa" hint="alunos por nível">
          <div className="space-y-2.5">
            {d.bandDistribution.map((b) => {
              const max = Math.max(1, ...d.bandDistribution.map((x) => x.count))
              return (
                <div key={b.key} className="flex items-center gap-3">
                  <span className={`w-24 shrink-0 text-xs font-medium ${toneText[b.tone] ?? 'text-ink'}`}>{b.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className={`h-full rounded-full ${toneBg[b.tone] ?? 'bg-primary'}`} style={{ width: `${Math.round((b.count / max) * 100)}%` }} />
                  </div>
                  <span className="w-6 text-right text-xs font-semibold tabular-nums text-ink">{b.count}</span>
                </div>
              )
            })}
          </div>
        </Panel>
        <Panel title="Evolução do raciocínio" hint="média mensal (AB4 /10)">
          <TrendLine points={d.trend} />
        </Panel>
      </div>

      {/* ───────── COMPORTAMENTO ───────── */}
      <SectionTitle hint="engajamento e risco da turma">Comportamento</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ativos (7 dias)" value={d.behavior.activeDays7} sub={`${d.totalStudents ? Math.round((d.behavior.activeDays7 / d.totalStudents) * 100) : 0}% da turma`} accent />
        <Stat label="Em risco" value={d.behavior.atRisk} sub="14+ dias sem usar" />
        <Stat label="Conclusão de casos" value={`${d.behavior.completion}%`} sub="finalizaram o que começaram" />
        <Stat label="Pico de estudo" value={peakLabel[d.behavior.study.peakBlock] ?? '—'} sub="horário mais frequente" />
      </div>
      <Panel title="Janela de estudo" hint="quando a turma estuda">
        <WeekdayBars byWeekday={d.behavior.study.byWeekday} />
      </Panel>

      {/* ───────── TURMAS ───────── */}
      <SectionTitle hint="por período">Turmas</SectionTitle>
      <Panel title="Desempenho por período">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-3 py-2 font-medium">Período</th>
                <th className="px-3 py-2 text-right font-medium">Alunos</th>
                <th className="px-3 py-2 text-right font-medium">Índice</th>
                <th className="px-3 py-2 text-right font-medium">Raciocínio</th>
                <th className="px-3 py-2 text-right font-medium">Comunicação</th>
                <th className="px-3 py-2 text-right font-medium">Conclusão</th>
                <th className="px-3 py-2 text-right font-medium">Em risco</th>
              </tr>
            </thead>
            <tbody>
              {d.turmas.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted">Nenhum aluno nesta instituição ainda.</td></tr>}
              {d.turmas.map((t) => (
                <tr key={t.periodo} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2.5">
                    <span className={t.isUnknown ? 'italic text-muted' : 'font-medium text-ink'}>{t.periodo}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{t.n}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-ink">{t.index ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{t.ab4 != null ? t.ab4.toFixed(1) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{t.comunicacao != null ? t.comunicacao.toFixed(1) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{t.completion}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums"><span className={t.atRisk > 0 ? 'font-semibold text-warning' : 'text-muted'}>{t.atRisk}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ───────── ALUNOS EM RISCO ───────── */}
      {d.atRiskStudents.length > 0 && (
        <>
          <SectionTitle hint="intervir primeiro aqui">Alunos em risco</SectionTitle>
          <Panel title="Sem atividade recente" hint={`${d.atRiskStudents.length} alunos`}>
            <ul className="divide-y divide-border/60">
              {d.atRiskStudents.slice(0, 15).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{studentLink(r)}{r.periodo ? <span className="ml-2 text-xs text-muted">{r.periodo}</span> : null}</span>
                  <span className="text-xs text-muted">{r.recency == null ? 'nunca usou' : `há ${r.recency} dias`}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}

      {/* ───────── LISTA COMPLETA ───────── */}
      <SectionTitle>Alunos</SectionTitle>
      <Panel title="Todos os alunos" hint="índice, faixa e engajamento">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-3 py-2 font-medium">Aluno</th>
                <th className="px-3 py-2 font-medium">Período</th>
                <th className="px-3 py-2 text-right font-medium">Índice</th>
                <th className="px-3 py-2 font-medium">Faixa</th>
                <th className="px-3 py-2 text-right font-medium">Simulados</th>
                <th className="px-3 py-2 text-right font-medium">Dias ativos</th>
                <th className="px-3 py-2 text-right font-medium">Recência</th>
              </tr>
            </thead>
            <tbody>
              {d.turmas.flatMap((t) => t.students).length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted">Nenhum aluno.</td></tr>}
              {d.turmas.flatMap((t) => t.students).sort((a, b) => (b.index ?? -1) - (a.index ?? -1)).map((r) => {
                const band = FORMATION_BANDS.find((b) => b.key === r.band)
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2.5">{studentLink(r)}</td>
                    <td className="px-3 py-2.5 text-xs text-muted">{r.periodo ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-ink">{r.index ?? '—'}</td>
                    <td className="px-3 py-2.5">{band ? <span className={`text-xs font-medium ${toneText[band.tone]}`}>{band.label}</span> : <span className="text-xs text-muted">—</span>}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">{r.simAvg != null ? `${Math.round(r.simAvg)}%` : '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">{r.activeDays}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className={r.atRisk ? 'text-warning' : 'text-muted'}>{r.recency == null ? '—' : `${r.recency}d`}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
