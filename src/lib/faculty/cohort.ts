// Agrupamento de alunos em TURMAS por período, dentro de uma instituição.
// Modelo aprovado: a instituição é a conta do diretor; a turma = (instituição,
// período). O período vem de profiles.faculty_period, que pode estar em branco
// nos alunos antigos — esses caem num bucket "Sem período" explícito.

export type CohortStudent = { id: string; periodo: string | null }

/** Normaliza o rótulo de período para agrupar (trim + colapsa espaços). */
export function normPeriodo(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().replace(/\s+/g, ' ')
  return v || null
}

export type Turma<T> = { periodo: string; isUnknown: boolean; students: T[] }

/**
 * Agrupa alunos por período. Quem não informou cai em "Sem período" (sempre por
 * último). Ordenação dos demais: numérica quando o rótulo começa por número
 * (1º, 2, 10º …), senão alfabética — para 10º não vir antes de 2º.
 */
export function groupByPeriodo<T extends CohortStudent>(students: T[]): Turma<T>[] {
  const UNKNOWN = 'Sem período'
  const map = new Map<string, T[]>()
  for (const s of students) {
    const key = normPeriodo(s.periodo) ?? UNKNOWN
    const arr = map.get(key)
    if (arr) arr.push(s)
    else map.set(key, [s])
  }
  const numOf = (label: string): number | null => {
    const m = label.match(/^\s*(\d+)/)
    return m ? parseInt(m[1], 10) : null
  }
  return [...map.entries()]
    .map(([periodo, list]) => ({ periodo, isUnknown: periodo === UNKNOWN, students: list }))
    .sort((a, b) => {
      if (a.isUnknown) return 1
      if (b.isUnknown) return -1
      const na = numOf(a.periodo)
      const nb = numOf(b.periodo)
      if (na != null && nb != null) return na - nb
      if (na != null) return -1
      if (nb != null) return 1
      return a.periodo.localeCompare(b.periodo, 'pt-BR')
    })
}
