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
 * Estratégia (upgrade seletivo):
 *   chat       → modelo forte: a conversa com o paciente é o DIFERENCIAL de imersão
 *   generation → modelo forte: gera o true_diagnosis, âncora de coerência de todo o caso
 *   utility    → modelo intermediário: validação/resumo/laudo/juiz AB4 etc. (invisível ao aluno)
 *
 * Se algum ID retornar 404/sem acesso na chave da OpenAI, troque aqui por uma alternativa
 * (ex: 'gpt-4.1' no lugar de 'gpt-5', 'gpt-4.1-mini' no lugar de 'gpt-5-mini').
 */
export const MODELS = {
  /** Conversa do paciente — imersão/persona. */
  chat: 'gpt-5',
  /** Geração do paciente (true_diagnosis e caso). */
  generation: 'gpt-5',
  /** Chamadas utilitárias: validação de exame, laudo, resumo, anamnese, clinical_status, juiz AB4, avaliação de diagnóstico. */
  utility: 'gpt-5-mini',
} as const

export type ModelRole = keyof typeof MODELS
