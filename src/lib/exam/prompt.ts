// Construção do prompt e parsing do simulado — PURO (sem 'server-only' nem client OpenAI),
// para ser importável em testes/harness de avaliação (ver generator-judge.eval.test.ts).
import { examOptions, examStructuralSpec, type ExamType, type ExamTrack } from './blueprint'
import type { ExamQuestion } from './validate'

export const KEYS = ['A', 'B', 'C', 'D', 'E']
const wc = (s: string): number => (s.match(/\p{L}+/gu) ?? []).length

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
    ? `EXEMPLO do NÍVEL MÍNIMO de detalhe (NÃO copie tema nem conteúdo; escreva assim ou com MAIS detalhe): «Em um município de 85.000 habitantes, a secretaria de saúde avaliou um novo teste rápido para triagem de determinada infecção em uma amostra de 1.000 pessoas da atenção primária, das quais 200 tinham a doença confirmada por padrão-ouro. O teste foi positivo em 180 dos 200 doentes e em 80 dos 800 não doentes. A prevalência estimada na população-alvo é de cerca de 5%. Considerando esses dados e o impacto da prevalência sobre o desempenho do teste, qual a conclusão correta sobre sua aplicação nesse cenário?» → ~90 palavras; alternativas com valores percentuais PRÓXIMOS e plausíveis (sensibilidade/especificidade/VPP), exigindo cálculo e interpretação para distinguir a certa dos distratores.`
    : `EXEMPLO do NÍVEL MÍNIMO de detalhe (NÃO copie tema nem conteúdo; escreva assim ou com MAIS detalhe): «Homem de 64 anos, tabagista de longa data e hipertenso em uso irregular de losartana, procura a emergência com dor torácica retroesternal em aperto iniciada há 40 minutos, de forte intensidade, irradiada para o membro superior esquerdo e associada a sudorese fria e náuseas. Ao exame, encontra-se ansioso, com PA de 150x95 mmHg, FC de 98 bpm, FR de 22 irpm, SatO2 de 95% em ar ambiente e ausculta cardíaca sem sopros. O eletrocardiograma mostra supradesnivelamento do segmento ST de 2 mm nas derivações inferiores (DII, DIII e aVF). A primeira troponina está em elevação. Qual a conduta imediata mais adequada?» → ~100 palavras; cada alternativa é uma conduta plausível (angioplastia primária, trombólise, estabilização clínica isolada…), diferenciadas por um detalhe fino do caso.`

  return [
    `Você é um elaborador de questões para o ${examDesc}.`,
    `Gere ${n} questões ORIGINAIS de "${areaLabel}", NOS MOLDES dessa prova. NUNCA copie questões reais — crie casos inéditos.`,
    `Temas de alto rendimento (ORDENADOS por incidência — priorize os primeiros, varie bem, não repita tema): ${topics}.`,
    '',
    'ESTRUTURA OBRIGATÓRIA (calibrada nas provas reais recentes — questão curta é REPROVADA):',
    `- COMPRIMENTO (REGRA MAIS IMPORTANTE — o erro clássico é escrever curto demais): cada enunciado tem ~${spec.stemTargetWords} palavras e NUNCA menos que ${spec.stemMinWords + 25} (pode chegar a ${spec.stemMaxWords} em casos complexos). Conte as palavras; se ficou abaixo de ${spec.stemMinWords + 25}, REESCREVA acrescentando antecedentes, exame físico e exames. Escreva SEMPRE no nível de detalhe do EXEMPLO abaixo (ou mais) — enunciados curtos são AUTOMATICAMENTE DESCARTADOS.`,
    quantitative
      ? `- NÃO é vinheta de paciente: contextualize em um CENÁRIO real da área — um estudo epidemiológico/tabela, uma situação de gestão/SUS, um dilema ético — desenvolvido em 5 a 8 frases, SEMPRE com DADOS NUMÉRICOS para leitura crítica (ao menos ${spec.numDataMin} números: tamanhos de amostra, taxas, incidência/prevalência, sensibilidade/especificidade, VPP/VPN, RR/OR, p-valor, intervalos de confiança). Termine com a pergunta objetiva de interpretação/decisão.`
      : `- Cada questão é uma VINHETA CLÍNICA completa, desenvolvida em 5 a 8 FRASES nesta ordem (1-2 frases cada): idade e sexo + queixa; HDA com evolução temporal; antecedentes e medicações relevantes; EXAME FÍSICO com SINAIS VITAIS numéricos (PA, FC, FR, Tax, SatO2); EXAMES COMPLEMENTARES COM VALORES E UNIDADES (laboratório, ECG, imagem descrita) quando pertinente; e a pergunta objetiva ("qual o diagnóstico mais provável?", "qual a conduta?", "qual o próximo passo?"). Inclua ao menos ${spec.numDataMin} dados numéricos objetivos.`,
    '- Questões INDEPENDENTES entre si (nenhuma depende de outra).',
    `- Exatamente ${nOpt} alternativas (keys ${keys}), UMA correta (single best answer). Alternativas PARALELAS: mesmo formato e extensão semelhante (cada uma com ${spec.optMinWords}+ palavras; nenhuma destoa em tamanho) — a correta NÃO pode se destacar por ser a mais longa/completa.`,
    ...(preReq ? [`- Prova de ESPECIALISTA: o enunciado é AINDA MAIS LONGO e aprofundado (alvo ~${spec.stemTargetWords} palavras) — discuta achados, exames prévios e evolução; e cada alternativa é uma conduta/afirmação COMPLETA com breve justificativa embutida (~12 a 30 palavras), no estilo das provas de pré-requisito.`] : []),
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

/** Monta o prompt do PASSE DE EXPANSÃO para os enunciados abaixo do alvo. Retorna null
 *  se nenhum precisa expandir. Puro — a chamada ao modelo fica em generate.ts/expandStems. */
export function buildExpandPrompt(qs: ExamQuestion[], exam: ExamType, track: ExamTrack, quantitative: boolean): { prompt: string; indices: number[] } | null {
  const spec = examStructuralSpec(exam, track)
  // Só expande quem está MEANINGFULMENTE abaixo do alvo (evita mexer no que já está bom).
  const floor = Math.round(spec.stemTargetWords * 0.9)
  const indices = qs.map((q, i) => ({ i, short: wc(q.prompt) < floor })).filter((x) => x.short).map((x) => x.i)
  if (indices.length === 0) return null
  // Mira a FAIXA CENTRADA NO ALVO (não o teto) p/ não estourar o comprimento das provas reais.
  const hi = Math.min(spec.stemMaxWords, spec.stemTargetWords + 25)
  const detalhe = quantitative
    ? 'acrescente contexto do cenário (população, período, números adicionais coerentes, limitações metodológicas)'
    : 'acrescente antecedentes e medicações, hábitos, exame físico com sinais vitais numéricos e exames complementares com valores e unidades'
  const list = indices.map((i) => `#${i + 1}: ${qs[i].prompt}`).join('\n\n')
  const prompt = [
    'Você reescreve ENUNCIADOS de questões de residência médica deixando-os MAIS LONGOS e detalhados, no padrão das provas reais.',
    `Para cada enunciado abaixo, REESCREVA-O com CERCA DE ${spec.stemTargetWords} palavras (faixa ${spec.stemTargetWords}–${hi}; NÃO ultrapasse ${hi}): ${detalhe}.`,
    'REGRAS ABSOLUTAS: preserve EXATAMENTE o cenário, os achados DISCRIMINANTES e a PERGUNTA final (não mude o que está sendo perguntado); só ADICIONE contexto de base plausível que NÃO altere o diagnóstico/conduta corretos. Não invente achados que contradigam o caso. Não cite alternativas. Não seja prolixo — pare ao atingir o alvo.',
    '',
    list,
    '',
    'Responda SOMENTE JSON: {"e":[{"i":1,"prompt":"<enunciado reescrito, mais longo>"}]} — uma entrada por enunciado, usando o mesmo número #i.',
  ].join('\n')
  return { prompt, indices }
}

/** Aplica a resposta do expansor: troca o enunciado apenas quando a reescrita é mais longa. */
export function applyExpansion(qs: ExamQuestion[], raw: string): ExamQuestion[] {
  const out = qs.map((q) => ({ ...q }))
  try {
    const o = JSON.parse(raw) as { e?: Array<{ i: number; prompt?: string }> }
    for (const e of o.e ?? []) {
      const at = e.i - 1
      if (at >= 0 && at < out.length && typeof e.prompt === 'string' && wc(e.prompt) > wc(out[at].prompt)) {
        out[at].prompt = e.prompt.trim()
      }
    }
  } catch { /* resposta inválida → mantém originais */ }
  return out
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
