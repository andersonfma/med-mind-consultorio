type Flashcard = {
  diagnosis?: string
  one_liner?: string
  key_features?: string[]
  how_it_presented?: string
  confirm_with?: string
  pearl?: string
}

export function DiagnosisFlashcard({ raw }: { raw: string | null | undefined }) {
  if (!raw) return null
  let fc: Flashcard
  try {
    fc = JSON.parse(raw) as Flashcard
  } catch {
    return null
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">Flashcard de revisão</span>
      </div>

      {fc.one_liner && <p className="mb-4 text-sm text-ink">{fc.one_liner}</p>}

      {Array.isArray(fc.key_features) && fc.key_features.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Achados-chave</p>
          <ul className="space-y-1">
            {fc.key_features.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fc.how_it_presented && (
        <div className="mb-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Como se apresentou</p>
          <p className="text-sm text-muted">{fc.how_it_presented}</p>
        </div>
      )}

      {fc.confirm_with && (
        <div className="mb-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Como confirmar</p>
          <p className="text-sm text-ink">{fc.confirm_with}</p>
        </div>
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
