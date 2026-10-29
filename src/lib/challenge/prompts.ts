export type GenQuiz = { prompt: string; options: { key: string; text: string }[]; correct_key: string; explanation: string }
export type GenDay = { day_index: number; stage: string; narrative: string; quiz: GenQuiz }
export type GeneratedWeek = { title: string; true_diagnosis: string; overview: string; review: string; days: GenDay[] }

const STAGES = ['anamnese', 'exame', 'complementares', 'sintese', 'conduta', 'complicacoes', 'conclusao'] as const

export function buildWeeklyCasePrompt(): string {
  return [
    'Você é um professor de Clínica Médica criando um "caso da semana" para estudantes.',
    'Crie UM caso clínico realista de Clínica Médica, com um diagnóstico verdadeiro ÚNICO e fechado',
    '(doença nomeável, não síndrome vaga), e desdobre-o em 7 dias (seg→dom), um quiz por dia:',
    '- dia 1 anamnese: apresentação/queixa e história; quiz sobre conduzir a anamnese/levantar hipóteses.',
    '- dia 2 exame: achados de exame físico; quiz sobre interpretar o exame/priorizar hipóteses.',
    '- dia 3 complementares: exames pedidos e resultados; quiz sobre interpretar os exames.',
    '- dia 4 sintese: síntese diagnóstica — qual a hipótese principal e o raciocínio que a sustenta; quiz sobre fechar a hipótese.',
    '- dia 5 conduta: quiz sobre a conduta terapêutica correta.',
    '- dia 6 complicacoes: complicações possíveis e prognóstico; quiz sobre reconhecer/prevenir a complicação.',
    '- dia 7 conclusao: fecha o diagnóstico; quiz confirma o diagnóstico; inclua a revisão do caso.',
    'Cada quiz: enunciado claro, exatamente 5 alternativas (keys A..E), UMA correta, e uma explicação didática.',
    'DIFICULDADE: nível de prova de residência (ENARE/ENAMED) — exige raciocínio, não reconhecimento imediato.',
    'Evite perguntas óbvias e alternativas absurdas ("de preenchimento").',
    'DISTRATORES (CRÍTICO): das 5 alternativas, pelo menos 2 devem ser ERRADAS MAS MUITO PLAUSÍVEIS — ',
    'opções que um bom aluno consideraria seriamente: o diferencial clássico mais provável, a armadilha/erro ',
    'frequente de prova, ou a conduta "quase certa" que falha num detalhe. A alternativa correta NÃO pode ser ',
    'a única séria/evidente; a diferença entre a correta e os 2 melhores distratores deve estar num detalhe fino ',
    'do caso (um achado discriminante, um valor, uma contraindicação).',
    'Na EXPLICAÇÃO, diga por que a correta é certa E por que os 2 principais distratores enganam (e o que os descarta).',
    'A narrativa de cada dia revela só o que é apropriado àquele ponto (sem entregar o diagnóstico antes do dia 5).',
    'Responda SOMENTE um JSON válido com as chaves: title, true_diagnosis, overview, review,',
    'days[] (day_index 1..7, stage em [anamnese,exame,complementares,sintese,conduta,complicacoes,conclusao], narrative,',
    'quiz{prompt, options[{key,text}], correct_key, explanation}).',
  ].join('\n')
}

export function parseWeeklyCase(raw: string): GeneratedWeek | null {
  try {
    const o = JSON.parse(raw) as GeneratedWeek
    if (!o?.title || !o.true_diagnosis || !o.overview || !o.review || !Array.isArray(o.days) || o.days.length !== 7) return null
    for (const d of o.days) {
      if (!STAGES.includes(d.stage as (typeof STAGES)[number])) return null
      const q = d.quiz
      if (!q?.prompt || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5) return null
      if (!q.options.some(op => op.key === q.correct_key)) return null
    }
    return o
  } catch { return null }
}
