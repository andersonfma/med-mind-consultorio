import type { Feature } from '@/lib/admin/retention'

type Curve = { dayMark: number; eligible: number; retained: number; pct: number }[]
type Lift = { feature: Feature; label: string; adopters: number; nonAdopters: number; retAdopt: number; retNon: number; lift: number }[]

export function RetentionSection({ d7, curve, lift, maturedN }: {
  d7: { eligible: number; retained: number; pct: number }; curve: Curve; lift: Lift; maturedN: number
}) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted">Base: {maturedN} alunos maduros (cadastrados há 7+ dias). <b className="text-ink">N pequeno → direcional, não estatístico.</b></p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Retenção D7</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink">{d7.pct}%</p>
          <p className="mt-0.5 text-xs text-muted">{d7.retained} de {d7.eligible} voltaram após 7 dias</p>
          <div className="mt-4 space-y-2">
            {curve.map((p) => (
              <div key={p.dayMark} className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-xs text-muted">D{p.dayMark}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${p.pct}%` }} />
                </div>
                <span className="w-16 text-right text-xs tabular-nums text-ink">{p.pct}% <span className="text-muted">({p.eligible})</span></span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Qual recurso mais retém (lift)</p>
          <p className="mb-2 mt-1 text-[11px] text-muted">lift = retenção de quem adotou − de quem não. Correlação, não causa.</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">Recurso</th>
                <th className="py-1 text-right font-medium">Adotou</th>
                <th className="py-1 text-right font-medium">Ret. sim/não</th>
                <th className="py-1 text-right font-medium">Lift</th>
              </tr>
            </thead>
            <tbody>
              {lift.map((r) => (
                <tr key={r.feature} className="border-t border-border/60">
                  <td className="py-1.5 text-ink">{r.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{r.adopters}{r.adopters < 5 ? '*' : ''}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{r.retAdopt}% / {r.retNon}%</td>
                  <td className={`py-1.5 text-right font-semibold tabular-nums ${r.lift > 0 ? 'text-success' : r.lift < 0 ? 'text-danger' : 'text-muted'}`}>{r.lift > 0 ? '+' : ''}{r.lift}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-muted">* base pequena (&lt; 5) — pouco confiável.</p>
        </div>
      </div>
    </div>
  )
}
