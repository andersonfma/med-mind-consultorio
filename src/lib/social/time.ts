/**
 * Tempo relativo compacto em pt-BR ("agora", "há 30 min", "há 2 h", "há 3 d",
 * "há 2 sem"); acima de ~30 dias cai para data curta (dd/mm/aa). `now` é injetável
 * para teste. Entrada inválida → string vazia (não quebra a UI).
 */
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diffS = Math.floor((now.getTime() - t) / 1000)
  if (diffS < 45) return 'agora'
  const min = Math.floor(diffS / 60)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d < 7) return `há ${d} d`
  const w = Math.floor(d / 7)
  if (d < 30) return `há ${w} sem`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
