type Flashcard = {
  diagnosis?: string
  one_liner?: string
  epidemiology?: string
  classic_presentation?: string
  key_diagnostics?: string[]
  // legado (cards antigos ancorados no caso) — ainda renderizados se vierem
  key_features?: string[]
  how_it_presented?: string
  confirm_with?: string
  management?: string
  pearl?: string
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      {children}
    </div>
  )
}

export function DiagnosisFlashcard({ raw }: { raw: string | null | undefined }) {
  if (!raw) return null
  let fc: Flashcard
  try {
    fc = JSON.parse(raw) as Flashcard
  } catch {
    return null
  }

  const diagnostics = fc.key_diagnostics ?? fc.key_features // compat com cards antigos

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">Flashcard de revisão</span>
      </div>

      {fc.one_liner && <p className="mb-4 text-sm text-ink">{fc.one_liner}</p>}

      {fc.epidemiology && (
        <Field label="Epidemiologia"><p className="text-sm text-muted">{fc.epidemiology}</p></Field>
      )}

      {(fc.classic_presentation || fc.how_it_presented) && (
        <Field label="Apresentação clássica">
          <p className="text-sm text-muted">{fc.classic_presentation ?? fc.how_it_presented}</p>
        </Field>
      )}

      {Array.isArray(diagnostics) && diagnostics.length > 0 && (
        <Field label="Diagnóstico — achados-chave">
          <ul className="space-y-1">
            {diagnostics.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Field>
      )}

      {(fc.management || fc.confirm_with) && (
        <Field label={fc.management ? 'Tratamento' : 'Como confirmar'}>
          <p className="text-sm text-ink">{fc.management ?? fc.confirm_with}</p>
        </Field>
      )}

      {fc.pearl && (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">Pérola</p>
          <p className="text-sm text-ink">{fc.pearl}</p>
        </div>
      )}
    </div>
  )
}
