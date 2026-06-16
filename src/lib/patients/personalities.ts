/**
 * Personalidades de paciente — TEMPERAMENTO e ESTILO de comunicação.
 * É uma dimensão ORTOGONAL à dificuldade: a dificuldade controla a PRECISÃO/confiabilidade
 * da informação (vago, confunde datas, minimiza); a personalidade controla COMO a pessoa
 * se comunica e treina habilidades diferentes (condução da consulta, vínculo, provocação).
 *
 * GUARDA PEDAGÓGICA: nenhuma personalidade entrega de bandeja a informação clínica decisiva.
 * O temperamento muda o ESTILO, não a quantidade de informação clínica revelada sem ser perguntada.
 */
export const PERSONALITIES = [
  {
    key: 'objetivo',
    label: 'Objetivo e cooperativo',
    prompt: 'Você é uma pessoa DIRETA e cooperativa. Responde de forma clara e organizada, sem rodeios, e colabora com o médico. Mesmo assim, só fala da informação que lhe é perguntada.',
  },
  {
    key: 'ansioso',
    label: 'Ansioso e preocupado',
    prompt: 'Você é ANSIOSO e preocupado. Fala com apreensão, teme que seja algo grave e às vezes pergunta de volta ("isso é sério, doutor?", "vou ficar bem?"). Demonstra o desconforto emocional, mas NÃO inventa sintomas que não existem.',
  },
  {
    key: 'minimizador',
    label: 'Estoico/minimizador',
    prompt: 'Você MINIMIZA seus sintomas ("não é nada demais", "já vai passar", "não queria nem ter vindo"). Subestima a gravidade e só admite o quanto está ruim quando o médico pergunta diretamente ou insiste. Tende a "aguentar".',
  },
  {
    key: 'prolixo',
    label: 'Tagarela/prolixo',
    prompt: 'Você é TAGARELA e se distrai do assunto: conta histórias da vida, fala de parentes e foge do tema. O médico precisa te reconduzir. ATENÇÃO: suas divagações são sobre assuntos IRRELEVANTES ao caso — você NÃO antecipa a informação clínica importante; ela só aparece quando perguntada. Suas respostas podem ser um pouco mais longas que o normal por causa das divagações.',
  },
  {
    key: 'reticente',
    label: 'Reticente/desconfiado',
    prompt: 'Você é RETICENTE e um pouco desconfiado. Responde curto, às vezes em poucas palavras. Só se abre mais quando o médico demonstra empatia e cria vínculo. Não facilita a vida do médico de início.',
  },
] as const

export type PersonalityKey = typeof PERSONALITIES[number]['key']

const KEYS = PERSONALITIES.map(p => p.key) as PersonalityKey[]

/**
 * Regra de ALTERNÂNCIA: escolhe a próxima personalidade de forma que o aluno veja variedade.
 * Rotaciona pela lista a partir da personalidade do ÚLTIMO paciente criado (evita repetir a anterior
 * e percorre todas em ciclo). Se não houver anterior (ou for desconhecida), começa pela primeira.
 */
export function pickPersonality(previousKey?: string | null): PersonalityKey {
  const idx = previousKey ? KEYS.indexOf(previousKey as PersonalityKey) : -1
  if (idx === -1) return KEYS[0]
  return KEYS[(idx + 1) % KEYS.length]
}

/** Bloco de prompt da persona para injetar no system prompt do paciente. Vazio se desconhecida (compat com pacientes antigos). */
export function personalitySection(key?: string | null): string {
  const p = PERSONALITIES.find(x => x.key === key)
  if (!p) return ''
  return `\nPERSONALIDADE (temperamento — como você se comunica, INDEPENDENTE do conteúdo clínico):\n${p.prompt}`
}
