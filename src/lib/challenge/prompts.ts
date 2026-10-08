export type GenQuiz = { prompt: string; options: { key: string; text: string }[]; correct_key: string; explanation: string }
export type GenDay = { day_index: number; stage: string; narrative: string; quiz: GenQuiz }
export type GeneratedWeek = { title: string; true_diagnosis: string; overview: string; review: string; days: GenDay[] }

const STAGES = ['anamnese', 'exame', 'complementares', 'conduta', 'conclusao'] as const

export function buildWeeklyCasePrompt(): string {
  return [
    'Você é um professor de Clínica Médica criando um "caso da semana" para estudantes.',
    'Crie UM caso clínico realista de Clínica Médica, com um diagnóstico verdadeiro ÚNICO e fechado',
    '(doença nomeável, não síndrome vaga), e desdobre-o em 5 dias (seg→sex), um quiz por dia:',
    '- dia 1 anamnese: apresentação/queixa e história; quiz sobre conduzir a anamnese/levantar hipóteses.',
    '- dia 2 exame: achados de exame físico; quiz sobre interpretar o exame/priorizar hipóteses.',
    '- dia 3 complementares: exames pedidos e resultados; quiz sobre interpretar os exames.',
    '- dia 4 conduta: quiz sobre a conduta terapêutica correta.',
    '- dia 5 conclusao: fecha o diagnóstico; quiz confirma o diagnóstico; inclua a revisão do caso.',
    'Cada quiz: enunciado claro, 4 ou 5 alternativas (keys A..E), UMA correta, e uma explicação didática.',
    'A narrativa de cada dia revela só o que é apropriado àquele ponto (sem entregar o diagnóstico antes do dia 5).',
    'Responda SOMENTE um JSON válido com as chaves: title, true_diagnosis, overview, review,',
    'days[] (day_index 1..5, stage em [anamnese,exame,complementares,conduta,conclusao], narrative,',
    'quiz{prompt, options[{key,text}], correct_key, explanation}).',
  ].join('\n')
}

export function parseWeeklyCase(raw: string): GeneratedWeek | null {
  try {
    const o = JSON.parse(raw) as GeneratedWeek
    if (!o?.title || !o.true_diagnosis || !o.overview || !o.review || !Array.isArray(o.days) || o.days.length !== 5) return null
    for (const d of o.days) {
      if (!STAGES.includes(d.stage as (typeof STAGES)[number])) return null
      const q = d.quiz
      if (!q?.prompt || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5) return null
      if (!q.options.some(op => op.key === q.correct_key)) return null
    }
    return o
  } catch { return null }
}
