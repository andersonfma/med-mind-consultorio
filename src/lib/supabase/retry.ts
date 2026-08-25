import 'server-only'

type WithError = { error: { code?: string; message?: string } | null }

function isClockSkewError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  // PGRST303: PostgREST rejeita o JWT porque o iat está "no futuro" em relação
  // ao relógio do validador — skew momentâneo entre GoTrue (emissão) e PostgREST
  // (validação), tipicamente logo após o container reiniciar.
  if (error.code === 'PGRST303') return true
  return /issued (at|in the) future/i.test(error.message ?? '')
}

/**
 * Reexecuta uma query do Supabase quando o erro é o transitório de relógio/token
 * (PGRST303 "JWT issued at future"). Um retry curto resolve porque o relógio do
 * validador já ultrapassou o `iat` do token. Erros não-transitórios retornam de
 * imediato, sem retry.
 *
 * Recebe uma FUNÇÃO que cria a query (o builder do Supabase só pode ser aguardado
 * uma vez, então cada tentativa precisa de um builder novo).
 */
export async function withClockSkewRetry<R extends WithError>(
  run: () => PromiseLike<R>,
  { retries = 2, delayMs = 600 }: { retries?: number; delayMs?: number } = {},
): Promise<R> {
  let res = await run()
  let attempt = 0
  while (isClockSkewError(res.error) && attempt < retries) {
    await new Promise((r) => setTimeout(r, delayMs))
    res = await run()
    attempt++
  }
  return res
}
