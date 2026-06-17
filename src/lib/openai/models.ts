/**
 * Fonte única de verdade para qual modelo cada tipo de chamada usa.
 * Trocar de modelo = mudar UMA linha aqui (antes estava hardcoded em ~9 lugares).
 *
 * Preços de referência (OpenAI, jun/2026, por 1M tokens — input/output):
 *   gpt-5        $1.25 / $10     (forte; input mais barato que o gpt-4o)
 *   gpt-5-mini   $0.25 / $2      (ótimo custo-benefício; bem acima do 4o-mini)
 *   gpt-4.1      $2.00 / $8
 *   gpt-4.1-mini $0.40 / $1.60
 *   gpt-4o-mini  $0.15 / $0.60   (legado — fraco em seguir instrução)
 *
 * Estratégia (upgrade seletivo) — família gpt-4.1, NÃO-reasoning:
 *   chat       → gpt-4.1: conversa rica do paciente E rápida (caminho interativo)
 *   generation → gpt-4.1: segue as regras do true_diagnosis muito melhor que o 4o-mini
 *   utility    → gpt-4.1-mini: validação/resumo/laudo/juiz AB4 etc. (invisível ao aluno)
 *
 * POR QUE NÃO gpt-5 (testado em prod, 2026-06-17): gpt-5 é modelo de REASONING — "pensa"
 * antes de responder, o que estourava o timeout de 25s na geração (caso não gerava) e deixaria
 * o chat interativo lento; além disso modelos de reasoning costumam REJEITAR `temperature`
 * (nossas rotas de exame/laudo usam temperature 0.3/0.5). gpt-4.1 é GA, rápido e aceita esses
 * params. (Se quiser experimentar gpt-5 no futuro: precisaria de reasoning_effort 'minimal' +
 * timeout maior + remover temperature das chamadas de reasoning.)
 *
 * Se algum ID retornar 404/sem acesso na chave, troque aqui (ex: 'gpt-4o' / 'gpt-4o-mini').
 * Preços jun/2026 (in/out por 1M): gpt-4.1 $2/$8, gpt-4.1-mini $0.40/$1.60.
 */
export const MODELS = {
  /** Conversa do paciente — imersão/persona, baixa latência. */
  chat: 'gpt-4.1',
  /** Geração do paciente (true_diagnosis e caso). */
  generation: 'gpt-4.1',
  /** Chamadas utilitárias: validação de exame, laudo, resumo, anamnese, clinical_status, juiz AB4, avaliação de diagnóstico. */
  utility: 'gpt-4.1-mini',
} as const

export type ModelRole = keyof typeof MODELS
