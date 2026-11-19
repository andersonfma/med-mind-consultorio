import 'server-only'
import { openai } from '@/lib/openai/client'
import { MODELS } from '@/lib/openai/models'
import { EXAM_AREAS, PRE_REQ_SPECIALTIES, examOptions, examStructuralSpec, isQuantitativeArea, type ExamType, type ExamTrack } from './blueprint'
import { passesSpec, type ExamQuestion } from './validate'

export type { ExamQuestion }

const KEYS = ['A', 'B', 'C', 'D', 'E']

export function buildExamPrompt(exam: ExamType, areaLabel: string, topics: string, n: number, track: ExamTrack = 'acesso-direto', quantitative = false): string {
  const nOpt = examOptions(exam)
  const keys = KEYS.slice(0, nOpt).join('..')
  const preReq = exam === 'enare' && track === 'pre-requisito'
  const examDesc = exam === 'enamed'
    ? 'ENAMED (Exame Nacional de Avaliação da Formação Médica, INEP) — alinhado às Diretrizes Curriculares e às competências para o exercício profissional'
    : preReq
      ? `ENARE — prova de PRÉ-REQUISITO (acesso a R3+) da subespecialidade "${areaLabel}": nível de especialista, questões longas e aprofundadas`
      : 'ENARE (Exame Nacional de Residência) — acesso direto (R1), nível de prova de residência médica'
  const spec = examStructuralSpec(exam, track)
  // Exemplar-ouro SINTÉTICO (ilustra nível/estrutura; nunca é prova real nem deve ser copiado).
  const exemplar = quantitative
    ? `EXEMPLO ILUSTRATIVO do nível e estrutura alvo (NÃO copie tema nem conteúdo): «Um teste de triagem para determinada condição foi avaliado em 1.000 pessoas, das quais 200 tinham a doença confirmada por padrão-ouro. O teste resultou positivo em 180 doentes e em 80 não doentes. Considerando esse cenário, qual a conclusão correta sobre o desempenho do teste?» → alternativas com valores percentuais PRÓXIMOS e plausíveis (sensibilidade/especificidade/VPP), exigindo o cálculo e a interpretação corretos para distinguir a certa dos distratores.`
    : `EXEMPLO ILUSTRATIVO do nível e estrutura alvo (NÃO copie tema nem conteúdo): «Homem de 64 anos, tabagista, com dor torácica retroesternal em aperto há 40 minutos, irradiada para o membro superior esquerdo, com sudorese. PA 150x95 mmHg, FC 98 bpm, SatO2 95%. ECG com supradesnível de ST de 2 mm em parede inferior. Qual a conduta imediata?» → cada alternativa é uma conduta plausível (angioplastia primária, trombólise, estabilização clínica isolada…), diferenciadas por um detalhe fino do caso.`

  return [
    `Você é um elaborador de questões para o ${examDesc}.`,
    `Gere ${n} questões ORIGINAIS de "${areaLabel}", NOS MOLDES dessa prova. NUNCA copie questões reais — crie casos inéditos.`,
    `Temas de alto rendimento (ORDENADOS por incidência — priorize os primeiros, varie bem, não repita tema): ${topics}.`,
    '',
    'ESTRUTURA OBRIGATÓRIA (calibrada nas provas reais recentes — questão curta é REPROVADA):',
    `- Enunciado com ${spec.stemMinWords} a ${spec.stemMaxWords} palavras (alvo ~${spec.stemTargetWords}). Enunciado curto/"seco" de decoreba é PROIBIDO.`,
    quantitative
      ? `- NÃO é vinheta de paciente: contextualize em um CENÁRIO real da área — um estudo epidemiológico/tabela, uma situação de gestão/SUS, um dilema ético — SEMPRE com DADOS NUMÉRICOS para leitura crítica (ao menos ${spec.numDataMin} números: tamanhos de amostra, taxas, incidência/prevalência, sensibilidade/especificidade, VPP/VPN, RR/OR, p-valor, intervalos de confiança). Termine com a pergunta objetiva de interpretação/decisão.`
      : `- Cada questão é uma VINHETA CLÍNICA completa, nesta ordem: idade e sexo; queixa + HDA com evolução temporal; antecedentes relevantes; EXAME FÍSICO com SINAIS VITAIS numéricos (PA, FC, FR, Tax, SatO2); e EXAMES COMPLEMENTARES COM VALORES E UNIDADES (laboratório, ECG, imagem descrita) quando pertinente. Inclua ao menos ${spec.numDataMin} dados numéricos objetivos. Termine com a pergunta objetiva ("qual o diagnóstico mais provável?", "qual a conduta?", "qual o próximo passo?").`,
    '- Questões INDEPENDENTES entre si (nenhuma depende de outra).',
    `- Exatamente ${nOpt} alternativas (keys ${keys}), UMA correta (single best answer). Alternativas PARALELAS: mesmo formato e extensão semelhante (cada uma com ${spec.optMinWords}+ palavras; nenhuma destoa em tamanho) — a correta NÃO pode se destacar por ser a mais longa/completa.`,
    ...(preReq ? [`- Como é prova de ESPECIALISTA: cada alternativa é uma conduta/afirmação COMPLETA com breve justificativa embutida (~12 a 30 palavras), no estilo das provas de pré-requisito.`] : []),
    '',
    'DIFICULDADE: nível de prova de residência — exige raciocínio clínico integrando os dados do caso, não reconhecimento imediato. Proibido pergunta óbvia ou alternativa absurda/de preenchimento.',
    `CALIBRAÇÃO COGNITIVA (a prova real não é decoreba): a MAIORIA das ${n} questões (~70%) deve exigir APLICAÇÃO/ANÁLISE — integrar os dados do caso/estudo para decidir conduta, diagnóstico ou interpretação; no máximo ~30% podem ser de reconhecimento contextualizado. NENHUMA de definição isolada ("o que é X").`,
    `DISTRATORES (CRÍTICO): pelo menos 2 das ${nOpt} alternativas devem ser ERRADAS MAS MUITO PLAUSÍVEIS — o diferencial clássico mais provável, a conduta "quase certa" que falha num detalhe, ou a armadilha frequente de prova. A diferença entre a correta e os melhores distratores deve estar num DETALHE FINO do caso (um achado discriminante, um valor, uma contraindicação).`,
    'EXPLICAÇÃO: por que a correta é certa E por que os 2 principais distratores enganam (o que os descarta).',
    'Cada questão traz um "topic" (o tema específico em 2-4 palavras).',
    '',
    exemplar,
    '',
    `Responda SOMENTE um JSON válido: {"questions":[{"prompt":"...","options":[{"key":"A","text":"..."}],"correct_key":"A","explanation":"...","topic":"..."}]} — com exatamente ${nOpt} options por questão.`,
  ].join('\n')
}

// A IA tende a colocar a alternativa correta sempre na letra A. Reembaralhamos as
// alternativas e reatribuímos as letras, para que o gabarito se distribua (A..E).
function shuffleOptions(q: ExamQuestion, nOpt: number): ExamQuestion {
  // marca a correta por referência (robusto a textos iguais) antes de embaralhar
  const tagged = q.options.map((op) => ({ text: op.text, correct: op.key === q.correct_key }))
  for (let i = tagged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[tagged[i], tagged[j]] = [tagged[j], tagged[i]]
  }
  const sliced = tagged.slice(0, nOpt)
  const options = sliced.map((t, i) => ({ key: KEYS[i], text: t.text }))
  const idx = sliced.findIndex((t) => t.correct)
  return { ...q, options, correct_key: KEYS[idx >= 0 ? idx : 0] }
}

export function parseExam(raw: string, n: number, nOpt: number): ExamQuestion[] | null {
  try {
    const o = JSON.parse(raw) as { questions?: ExamQuestion[] }
    const qs = o.questions
    if (!Array.isArray(qs) || qs.length === 0) return null
    const clean = qs.filter(
      (q) => q?.prompt && Array.isArray(q.options) && q.options.length === nOpt
        && q.options.some((op) => op.key === q.correct_key) && typeof q.explanation === 'string' && q.explanation,
    )
    if (!clean.length) return null
    return clean.slice(0, n).map((q) => shuffleOptions(q, nOpt))
  } catch {
    return null
  }
}

/**
 * Verificação INDEPENDENTE do gabarito: um 2º modelo resolve cada questão SEM ver a
 * resposta marcada e sinaliza ambiguidade. Mantemos a questão só se a resposta dele
 * bate com o gabarito E ele não a considerou ambígua — assim gabarito errado ou
 * questão "sem discriminante" (ex.: DM1 vs DM2 sem dado que decida) não passa.
 * Em falha do verificador, não bloqueia o simulado (degrada para só-estrutural).
 */
export async function verifyAnswers(qs: ExamQuestion[]): Promise<boolean[]> {
  if (qs.length === 0) return []
  const list = qs.map((q, i) => `Q${i + 1}. ${q.prompt}\n${q.options.map((o) => `${o.key}) ${o.text}`).join('\n')}`).join('\n\n')
  const prompt = [
    'Você é um professor revisor RIGOROSO de provas de residência médica (ENARE/ENAMED).',
    'Resolva CADA questão de forma independente, escolhendo a ÚNICA melhor alternativa segundo as diretrizes atuais.',
    'Marque "ambigua": true se mais de uma alternativa for defensável OU se o enunciado NÃO traz um dado que DISCRIMINE a resposta (ex.: diferenciar dois diagnósticos sem o achado que os separa).',
    'Dê também sua confiança de 0 a 1.',
    '',
    list,
    '',
    'Responda SOMENTE JSON: {"v":[{"i":1,"resposta":"A","ambigua":false,"conf":0.9}]} — uma entrada por questão.',
  ].join('\n')
  try {
    const completion = await openai.chat.completions.create({
      model: MODELS.generation,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }, { timeout: 90_000 })
    const o = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as { v?: Array<{ i: number; resposta: string; ambigua?: boolean; conf?: number }> }
    const v = o.v ?? []
    return qs.map((q, i) => {
      const r = v.find((x) => x.i === i + 1)
      if (!r) return false
      return r.resposta === q.correct_key && !r.ambigua && (r.conf === undefined || r.conf >= 0.6)
    })
  } catch {
    return qs.map(() => true) // verificador indisponível → não bloqueia (fica a validação estrutural)
  }
}

/** Gera um simulado curto, no formato e TRILHA do exame (ENARE acesso direto/pré-requisito, ENAMED).
 *  Sobre-solicita, valida contra o blueprint estrutural da trilha e regenera para completar. */
export async function generateExam(exam: ExamType, areaKey: string, n: number, track: ExamTrack = 'acesso-direto'): Promise<ExamQuestion[] | null> {
  const preReq = exam === 'enare' && track === 'pre-requisito'
  const resolved = preReq
    ? PRE_REQ_SPECIALTIES.find((s) => s.key === areaKey)
    : EXAM_AREAS.find((a) => a.key === areaKey)
  if (!resolved) return null
  const nOpt = examOptions(exam)
  // Pré-requisito é sempre clínico/especialista; só acesso-direto/ENAMED têm áreas quantitativas.
  const quantitative = !preReq && isQuantitativeArea(resolved.key)
  const collected: ExamQuestion[] = []

  for (let attempt = 0; attempt < 3 && collected.length < n; attempt++) {
    const need = n - collected.length
    const req = Math.min(need + 2, n + 2) // buffer para compensar as reprovadas
    const completion = await openai.chat.completions.create({
      model: MODELS.generation,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildExamPrompt(exam, resolved.label, resolved.topics, req, track, quantitative) }],
    }, { timeout: 90_000 })
    const raw = completion.choices[0]?.message?.content
    const parsed = (raw ? parseExam(raw, req, nOpt) : null) ?? []
    const structural = parsed.filter((q) => passesSpec(q, exam, quantitative, track))
    if (structural.length === 0) continue
    // Verificação independente do gabarito antes de aceitar.
    const ok = await verifyAnswers(structural)
    structural.forEach((q, i) => { if (ok[i] && collected.length < n) collected.push(q) })
  }
  return collected.length ? collected.slice(0, n) : null
}
