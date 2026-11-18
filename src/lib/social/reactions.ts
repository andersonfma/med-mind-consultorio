// Conjunto de reações por emoji disponíveis nos posts. Compartilhado entre a rota
// de reação (validação) e a UI (barra de reações).
export const REACTION_EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '👏'] as const
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]
