// Índice de Formação: um "valor de graduação" 0–100 por aluno, combinando os
// sinais pedagógicos da plataforma (raciocínio, comunicação, conduta, fecho
// diagnóstico e desempenho em simulados). Serve para o diretor enxergar a turma
// em faixas e compará-la com a média nacional.
//
// Benchmark nacional: NÃO há microdados oficiais públicos do ENAMED. A v1 usa a
// distribuição nacional DA PLATAFORMA (todos os alunos) como proxy, rotulada como
// tal, e deixa as faixas plugáveis — quando houver cortes oficiais do ENAMED,
// basta passar outro `cutoffs`/população e tudo recalibra.

export type ComponentScores = {
  raciocinio?: number | null // AB4 geral, 0–100
  comunicacao?: number | null // comunicação, 0–100
  conduta?: number | null // % de condutas adequadas, 0–100
  diagnostico?: number | null // % de casos fechados sem revelar, 0–100
  simulados?: number | null // % de acerto médio em simulados, 0–100
}

// Pesos padrão: priorizam raciocínio clínico e simulados (mais próximos do ENAMED),
// sem ignorar conduta, diagnóstico e comunicação. Somam 1.
export const DEFAULT_WEIGHTS: Required<Record<keyof ComponentScores, number>> = {
  raciocinio: 0.3,
  simulados: 0.3,
  conduta: 0.15,
  diagnostico: 0.15,
  comunicacao: 0.1,
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

/**
 * Índice de Formação 0–100 como média ponderada dos componentes PRESENTES
 * (os ausentes/null são ignorados e os pesos restantes renormalizados). Retorna
 * null se nenhum componente tem dado — para o diretor saber que falta base, em
 * vez de ver um zero enganoso.
 */
export function formationIndex(
  c: ComponentScores,
  weights: Record<keyof ComponentScores, number> = DEFAULT_WEIGHTS,
): number | null {
  let sum = 0
  let wsum = 0
  for (const key of Object.keys(weights) as (keyof ComponentScores)[]) {
    const v = c[key]
    if (v == null || Number.isNaN(v)) continue
    const w = weights[key]
    sum += clamp(v) * w
    wsum += w
  }
  if (wsum === 0) return null
  return Math.round(sum / wsum)
}

export type Band = { key: string; label: string; min: number; tone: string }

// Faixas fixas de desempenho (0–100). Rótulos pensados para a coordenação.
export const FORMATION_BANDS: Band[] = [
  { key: 'insuficiente', label: 'Insuficiente', min: 0, tone: 'danger' },
  { key: 'regular', label: 'Regular', min: 40, tone: 'warning' },
  { key: 'bom', label: 'Bom', min: 60, tone: 'chart-2' },
  { key: 'excelente', label: 'Excelente', min: 80, tone: 'success' },
]

/** Faixa de um score segundo os cortes (maior `min` que o score alcança). */
export function bandFor(score: number | null, bands: Band[] = FORMATION_BANDS): Band | null {
  if (score == null) return null
  let out: Band | null = null
  for (const b of bands) if (score >= b.min) out = b
  return out
}

/**
 * Percentil (0–100) de um score frente a uma população (benchmark nacional-proxy).
 * Percentil = % da população com valor MENOR que o score. População vazia => null.
 */
export function benchmarkPercentile(score: number | null, population: number[]): number | null {
  if (score == null || population.length === 0) return null
  const below = population.filter((p) => p < score).length
  return Math.round((below / population.length) * 100)
}

/** Média simples de índices válidos (para o índice da turma). null se vazio. */
export function meanIndex(values: Array<number | null>): number | null {
  const v = values.filter((x): x is number => x != null && !Number.isNaN(x))
  if (v.length === 0) return null
  return Math.round(v.reduce((s, x) => s + x, 0) / v.length)
}
