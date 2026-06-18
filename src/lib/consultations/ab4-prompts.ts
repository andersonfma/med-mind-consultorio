import type { Patient } from '@/types/domain'
import type { ChatMessage } from './prompts'
import type { Ab4Stage } from './ab4'

export interface Ab4ExamInput {
  exam_name: string
  justification: string | null
  result: string | null
  status: string
}

export function buildAb4ScorePrompt(
  patient: Patient,
  chatHistory: ChatMessage[],
  examRequests: Ab4ExamInput[],
  physicalExamSummary: string,
  clinicalReasoning: string,
  stage: Ab4Stage = 2,
): string {
  const conversation = chatHistory.length > 0
    ? chatHistory.map(m => `${m.role === 'student' ? 'Médico' : 'Paciente'}: ${m.content}`).join('\n')
    : '(sem conversa)'

  // Na etapa 1 (primeira consulta) os resultados ainda NÃO foram revelados ao aluno
  // (eles aparecem só na próxima consulta) — não exibimos resultados ao juiz.
  const exams = examRequests.length > 0
    ? examRequests.map(e =>
        stage === 1
          ? `- ${e.exam_name} [${e.status}]\n  justificativa do aluno: ${e.justification?.trim() || '(não justificou)'}\n  resultado: (ainda não revelado — disponível só na próxima consulta)`
          : `- ${e.exam_name} [${e.status}]\n  justificativa do aluno: ${e.justification?.trim() || '(não justificou)'}\n  resultado: ${e.result?.trim() || '(sem resultado)'}`
      ).join('\n')
    : '(nenhum exame solicitado)'

  const trueDiag = (patient as Record<string, unknown>).true_diagnosis as string | null

  const header = `Você é um avaliador do método AB4 de raciocínio clínico. Avalie a QUALIDADE DO RACIOCÍNIO do aluno nesta consulta simulada.

REGRA DE INDEPENDÊNCIA (CRÍTICA): o diagnóstico verdadeiro do caso é fornecido APENAS para você entender o caso. A nota é INDEPENDENTE de o aluno ter acertado ou não o diagnóstico — um aluno pode raciocinar muito bem e errar, e vice-versa. NÃO premie nem penalize pelo acerto; avalie o PROCESSO de pensamento.

CASO:
Paciente: ${patient.name}, ${patient.age} anos. Queixa: ${patient.chief_complaint}.
Diagnóstico verdadeiro (apenas contexto): ${trueDiag || '(desconhecido)'}

ANAMNESE (conversa médico-paciente):
${conversation}

EXAME FÍSICO (resumo): ${physicalExamSummary || '(não registrado)'}

EXAMES SOLICITADOS PELO ALUNO (nome, status, justificativa, resultado):
${exams}

PENSAMENTO CLÍNICO REGISTRADO PELO ALUNO:
${clinicalReasoning || '(não registrado)'}
`

  const a1a2 = `- A1 (Imaginação Poética) — amplitude de hipóteses e abertura da anamnese. Nota alta: explorou vários mundos clínicos possíveis, perguntou o que expandia a cena (cronologia, contexto, exposições, achados negligenciados). Nota baixa: afunilou cedo, rotulação precoce, anamnese estreita.
- A2 (Plausibilidade Retórica) — priorização plausível e mecanismo. Nota alta: hierarquizou hipóteses por probabilidade/risco/coerência/fisiopatologia, adequadas a ESTE paciente. Nota baixa: lista solta, fascínio por raro, sem mecanismo.`

  const calibration = `CALIBRAÇÃO DA ESCALA (use toda a escala, não concentre em 7-8):
0-2 falha grave/ausente · 3-4 fraco · 5-6 adequado · 7-8 bom · 9-10 excelente.
Se houver POUCA evidência observável de um eixo (o aluno quase não interagiu, ou não registrou pensamento clínico), dê nota BAIXA nesse eixo — ausência de raciocínio observável é nota baixa, não média.`

  if (stage === 1) {
    return `${header}
ETAPA DA AVALIAÇÃO: PRIMEIRA CONSULTA. Avalie SOMENTE os eixos A1 e A2 (abertura do raciocínio). Os resultados dos exames AINDA NÃO foram revelados ao aluno (só aparecem na próxima consulta), portanto NÃO avalie e NÃO penalize a interpretação de exames (A3) nem a conclusão analítica final (A4) — esses eixos serão avaliados na próxima consulta. NÃO cobre do aluno interpretar resultados que ele ainda não tem.

EIXOS A AVALIAR (somente 2, nota inteira de 0 a 10 cada):
${a1a2}

${calibration}

RECOMENDAÇÃO: um único texto formativo curto (2 a 4 frases), em português, dirigido ao aluno ("você..."), focando o eixo de MENOR nota entre A1 e A2 — nomeie a falha específica e a conduta de pensamento que faltou na ABERTURA do raciocínio (amplitude de hipóteses / priorização). NÃO comente sobre exames ou conclusão final. Tom de coaching.

Responda APENAS com JSON válido, sem texto adicional:
{
  "a1": número inteiro 0-10,
  "a2": número inteiro 0-10,
  "recommendation": "texto da recomendação"
}`
  }

  return `${header}
ETAPA DA AVALIAÇÃO: CONSULTA DE RETORNO. Avalie os 4 eixos (já há resultados de exames a interpretar).

EIXOS A AVALIAR (nota inteira de 0 a 10 cada):
${a1a2}
- A3 (Confrontação Dialética) — justificar cada exame e interpretar o RESULTADO frente à hipótese. Nota alta: para cada exame, o aluno explica por que o pediu e interpreta o resultado ligando-o à hipótese (este achado confirma / este enfraquece). Nota baixa: pede exames sem justificar, ou recebe resultados e não os interpreta / não conecta à hipótese. NÃO exija que o aluno cite exames que refutariam a hipótese — avalie a justificativa e a interpretação dos resultados que ele de fato fez.
- A4 (Demonstração Analítica) — justificação integrada com incerteza proporcional. Nota alta: o pensamento clínico conecta história + exame + exames + mecanismo e justifica, sem excesso de certeza. Nota baixa: nomeia sem justificar, ou superestima a certeza.

${calibration}

RECOMENDAÇÃO: escreva um único texto formativo curto (2 a 4 frases), em português, dirigido ao aluno ("você..."), priorizando os 1 ou 2 eixos de MENOR nota — nomeie a falha específica daquele eixo e a conduta de pensamento que faltou. Tom de coaching.

Responda APENAS com JSON válido, sem texto adicional:
{
  "a1": número inteiro 0-10,
  "a2": número inteiro 0-10,
  "a3": número inteiro 0-10,
  "a4": número inteiro 0-10,
  "recommendation": "texto da recomendação"
}`
}
