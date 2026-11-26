export type GenQuiz = { prompt: string; options: { key: string; text: string }[]; correct_key: string; explanation: string }
export type GenDay = { day_index: number; stage: string; narrative: string; quiz: GenQuiz }
export type GeneratedWeek = { title: string; true_diagnosis: string; overview: string; review: string; days: GenDay[] }

const STAGES = ['anamnese', 'exame', 'complementares', 'sintese', 'conduta', 'complicacoes', 'conclusao'] as const

export function buildWeeklyCasePrompt(): string {
  return [
    'Você é um professor de Clínica Médica criando um "caso da semana" para estudantes de nível de RESIDÊNCIA.',
    'Crie UM caso clínico realista de Clínica Médica, com um diagnóstico verdadeiro ÚNICO e fechado',
    '(doença nomeável, não síndrome vaga), e desdobre-o em 7 dias (seg→dom), um quiz por dia.',
    'ESCOLHA DO CASO (importante p/ a dificuldade): prefira um diagnóstico com DIFERENCIAIS PRÓXIMOS e realistas,',
    'que competem de verdade até o dia 4 (ex.: dois diagnósticos separados por um único achado/valor). EVITE doenças de',
    'apresentação óbvia/patognomônica — se o diagnóstico "salta aos olhos" na vinheta, o caso está fácil demais.',
    '- dia 1 anamnese: apresentação/queixa e história; quiz sobre conduzir a anamnese/levantar hipóteses.',
    '- dia 2 exame: achados de exame físico; quiz sobre interpretar o exame/priorizar hipóteses.',
    '- dia 3 complementares: exames pedidos e resultados; quiz sobre interpretar os exames.',
    '- dia 4 sintese: síntese diagnóstica — qual a hipótese principal e o raciocínio que a sustenta; quiz sobre fechar a hipótese.',
    '- dia 5 conduta: quiz sobre a conduta terapêutica correta.',
    '- dia 6 complicacoes: complicações possíveis e prognóstico; quiz sobre reconhecer/prevenir a complicação.',
    '- dia 7 conclusao: fecha o diagnóstico; quiz confirma o diagnóstico; inclua a revisão do caso.',
    'Cada quiz: enunciado claro, exatamente 5 alternativas (keys A..E), UMA correta, e uma explicação didática.',
    'DIFICULDADE (REGRA MAIS IMPORTANTE — o erro clássico é gerar questão fácil): nível de prova de residência',
    '(ENARE/ENAMED). Cada quiz EXIGE raciocínio sobre ESTE caso — integrar os dados da vinheta para decidir — nunca',
    'cultura geral, definição isolada ou reconhecimento imediato. PROIBIDO: pergunta cuja resposta é óbvia pelo enunciado,',
    'alternativa absurda/de preenchimento, ou acerto por eliminação trivial.',
    'DISTRATORES (CRÍTICO): das 5 alternativas, pelo menos 3 devem ser ERRADAS MAS MUITO PLAUSÍVEIS — opções que um',
    'bom residente consideraria seriamente: o diferencial clássico mais provável, a armadilha/erro frequente de prova,',
    'a conduta "quase certa" que falha num detalhe. A correta NÃO pode ser a única séria/completa, nem a mais longa; a',
    'diferença entre a correta e os melhores distratores está num DETALHE FINO do caso (um achado discriminante, um valor, uma contraindicação).',
    'AUTO-CHECAGEM obrigatória por quiz: se um bom aluno acerta SEM ler a vinheta (por cultura geral) ou por eliminação',
    'óbvia, a questão está FÁCIL DEMAIS — reescreva deixando os distratores mais fortes e a decisão dependente de um dado do caso.',
    'EXEMPLO do nível: em vez de "Qual o provável diagnóstico?" com uma doença evidente, pergunte "qual achado DESCARTA o',
    'principal diferencial?" ou "qual o próximo passo que muda a conduta?", com 3 alternativas defensáveis à primeira vista.',
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
