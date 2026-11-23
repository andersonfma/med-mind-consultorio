// Fuso oficial do app: horário de Brasília. Server components renderizam no fuso do
// servidor (UTC em produção), então datas/horas DEVEM ser formatadas explicitamente aqui,
// e o "dia de hoje" calculado no fuso de Brasília (não em UTC) — senão o dia vira 3h cedo.
export const APP_TZ = 'America/Sao_Paulo'

/** Data de HOJE em Brasília, YYYY-MM-DD. ('en-CA' formata como ISO.) */
export function todayBR(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Interpreta um YYYY-MM-DD (calendário) como meia-noite UTC, p/ aritmética de dias. */
export function ymdToUTCDate(ymd: string): Date {
  return new Date(ymd + 'T00:00:00Z')
}

/** Data+hora no fuso de Brasília (ex.: 23/11/26 14:05). */
export function formatDateTimeBR(iso: string | number | Date): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: APP_TZ, dateStyle: 'short', timeStyle: 'short' })
}

/** Só a data, no fuso de Brasília (ex.: 23/11/26). */
export function formatDateBR(iso: string | number | Date): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: APP_TZ, day: '2-digit', month: '2-digit', year: '2-digit' })
}
