// Classificação da origem do Premium e agregações de perfil (faculdade / tipo).
// Funções puras — testadas isoladamente — para o painel do coordenador e para a
// leitura de investidor (quem é premium e por quê; de onde vêm os alunos).

export type PremiumSource = 'fundador' | 'hotmart' | 'manual' | 'none'

/**
 * Decide a origem do Premium de um usuário a partir de 3 sinais já carregados:
 * - isPremium: selo atual no profile
 * - hasFounder: existe resgate de código de fundador (founder_redemptions)
 * - hasPayment: existe pagamento aprovado na Hotmart (payment_events)
 *
 * Precedência: pagamento real > fundador > manual. Um usuário pode ter resgatado
 * fundador E comprado depois; nesse caso contamos como Hotmart (receita real).
 * Se não é premium, 'none'. Se é premium sem rastro, 'manual' (concessão via admin)
 * — é exatamente o caso que precisa de atenção (premium sem venda nem cupom).
 */
export function premiumSource(isPremium: boolean, hasFounder: boolean, hasPayment: boolean): PremiumSource {
  if (!isPremium) return 'none'
  if (hasPayment) return 'hotmart'
  if (hasFounder) return 'fundador'
  return 'manual'
}

export const PREMIUM_SOURCE_LABEL: Record<PremiumSource, string> = {
  fundador: 'Fundador (cupom)',
  hotmart: 'Hotmart (pago)',
  manual: 'Manual',
  none: '—',
}

/** Normaliza o nome da faculdade para agregação (trim + colapsa espaços). Vazio => null. */
export function normFaculty(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().replace(/\s+/g, ' ')
  return v || null
}

export type FacultyRow = { faculty: string; students: number; doctors: number; total: number }

/**
 * Agrega usuários por faculdade, separando estudantes de médicos. Entradas sem
 * faculdade preenchida caem no bucket 'Não informado' para ficar explícito quanto
 * do dado ainda falta (não some do total).
 */
export function aggregateByFaculty(
  people: Array<{ faculty: string | null; user_type: string | null }>,
): FacultyRow[] {
  const map = new Map<string, { students: number; doctors: number }>()
  for (const p of people) {
    const key = normFaculty(p.faculty) ?? 'Não informado'
    const cur = map.get(key) ?? { students: 0, doctors: 0 }
    if (p.user_type === 'doctor') cur.doctors++
    else cur.students++
    map.set(key, cur)
  }
  return [...map.entries()]
    .map(([faculty, v]) => ({ faculty, students: v.students, doctors: v.doctors, total: v.students + v.doctors }))
    .sort((a, b) => {
      // 'Não informado' sempre por último; resto por total desc.
      if (a.faculty === 'Não informado') return 1
      if (b.faculty === 'Não informado') return -1
      return b.total - a.total
    })
}
