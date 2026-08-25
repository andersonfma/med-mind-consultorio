import 'server-only'
import { NextResponse } from 'next/server'

export interface AiQuotaResult {
  ok: boolean
  /** Saldo restante no período, quando conhecido. */
  remaining: number | null
}

// Interface mínima do client do Supabase — evita acoplar aos tipos gerados
// do banco (que ainda não conhecem o RPC consume_ai_call). `rpc` é declarado
// como MÉTODO (não propriedade-arrow) de propósito: a checagem bivariante de
// parâmetros permite passar o client tipado (cujo rpc só conhece
// 'create_patient') sem erro de variância.
type RpcClient = {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>
}

/**
 * Consome 1 chamada de IA do orçamento do usuário autenticado (RPC atômico
 * consume_ai_call). Chame ANTES de bater na OpenAI, para que um usuário no
 * limite não gere custo.
 *
 * Retorna ok:false SOMENTE quando o teto do período foi atingido (US010).
 * Em qualquer outro erro (ex.: RPC ainda não migrado em produção), faz
 * fail-open (ok:true) para não derrubar a experiência — o custo continua
 * limitado pelos slots de pacientes.
 */
export async function consumeAiCall(supabase: RpcClient): Promise<AiQuotaResult> {
  // Defensivo: se o client não expõe rpc (ex.: mocks de teste), não bloqueia.
  if (typeof (supabase as { rpc?: unknown }).rpc !== 'function') {
    return { ok: true, remaining: null }
  }
  const res = await supabase.rpc('consume_ai_call')
  if (!res) return { ok: true, remaining: null }
  const { data, error } = res
  if (error) {
    if (error.code === 'US010') return { ok: false, remaining: 0 }
    return { ok: true, remaining: null }
  }
  return { ok: true, remaining: typeof data === 'number' ? data : null }
}

/** Resposta 429 padrão quando o teto de IA do usuário é atingido. */
export function aiQuotaExceededResponse() {
  return NextResponse.json(
    {
      error: 'ai_quota_exceeded',
      message:
        'Você atingiu o limite de uso de IA deste período. O limite é renovado a cada 30 dias.',
    },
    { status: 429 },
  )
}
