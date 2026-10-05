import type { Patient } from '@/types/domain'

export function buildTrueDiagnosisAndEvalPrompt(
  patient: Patient,
  studentDiagnosis: string
): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'

  return `Você é um especialista médico avaliando uma simulação clínica.

Perfil do paciente simulado:
- Nome: ${patient.name}, ${patient.age} anos, ${patient.gender === 'M' ? 'masculino' : 'feminino'}
- Especialidade: ${patient.specialty}
- Queixa principal: ${patient.chief_complaint}
- Condições preexistentes: ${conditions}
- Dificuldade do caso: ${patient.difficulty}

Diagnóstico proposto pelo aluno: "${studentDiagnosis}"

Sua tarefa (duas partes):
1. Determine qual seria o diagnóstico verdadeiro mais provável para este paciente simulado.
2. Avalie se o diagnóstico do aluno é clinicamente válido E compatível com o diagnóstico verdadeiro.

REGRAS RÍGIDAS para "compatible: true":
- O aluno DEVE nomear uma condição clínica específica (ex: "Insuficiência Cardíaca", "DPOC", "Hipertireoidismo", "Colite Microscópica")
- Sintomas isolados NUNCA são diagnósticos: "falta de ar", "cansaço", "dor", "febre" → sempre "compatible: false"
- Síndromes genéricas sem especificidade: "processo inflamatório", "síndrome gripal" → "compatible: false"
- Aceite variações de terminologia, siglas reconhecidas (IAM, DPOC, TEP) ou síndrome equivalente bem definida
- Em caso de dúvida → "compatible: false"

Responda APENAS com JSON válido:
{
  "true_diagnosis": "diagnóstico verdadeiro em termos médicos precisos",
  "compatible": false,
  "reasoning": "frase curta: se sintoma, dizer que não é diagnóstico; se incorreto, explicar brevemente"
}`
}

export function buildTrueDiagnosisOnlyPrompt(patient: Patient): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'

  return `Você é um especialista médico. Determine o diagnóstico verdadeiro mais provável para o paciente simulado abaixo.

Perfil:
- Especialidade: ${patient.specialty}
- Queixa principal: ${patient.chief_complaint}
- Condições preexistentes: ${conditions}
- Dificuldade: ${patient.difficulty}

Responda APENAS com JSON válido:
{
  "true_diagnosis": "diagnóstico verdadeiro em termos médicos precisos"
}`
}

export function buildClinicalSummaryPrompt(
  patient: Patient,
  trueDiagnosis: string
): string {
  return `Você é um educador médico. Escreva um resumo clínico educativo sobre o diagnóstico abaixo para um aluno de medicina.

Paciente: ${patient.age} anos, ${patient.specialty}, queixa: ${patient.chief_complaint}
Diagnóstico: ${trueDiagnosis}

O resumo deve conter (em texto corrido, sem markdown, sem tópicos com asterisco):
1. Definição e epidemiologia resumida
2. Fisiopatologia em 2-3 frases
3. Apresentação clínica típica
4. Abordagem diagnóstica principal
5. Linhas de tratamento

Máximo 300 palavras. Texto simples, sem formatação markdown.`
}

/**
 * Flashcard de revisão sobre o TEMA (a doença) — card de estudo canônico e
 * reutilizável, NÃO sobre o caso específico. Retorna JSON.
 */
export function buildDiagnosisFlashcardPrompt(
  patient: Patient,
  trueDiagnosis: string,
): string {
  return `Você é um educador médico. Gere um FLASHCARD de estudo sobre a DOENÇA/TEMA abaixo, para um aluno de medicina — um card canônico de revisão da doença, NÃO sobre um caso específico. Não mencione "este paciente" nem o caso simulado; fale da doença em geral.

Doença/Tema: ${trueDiagnosis}
(Área: ${patient.specialty})

Gere um flashcard OBJETIVO e de ALTO VALOR de estudo. Frases curtas (não parágrafos longos), em linguagem de revisão.

Responda APENAS com JSON válido:
{
  "diagnosis": "nome canônico da doença",
  "one_liner": "definição da doença em 1 frase",
  "epidemiology": "epidemiologia essencial em 1 frase (quem/quando é mais comum, fatores de risco principais)",
  "classic_presentation": "apresentação clínica CLÁSSICA (sinais e sintomas típicos) em 1-2 frases",
  "key_diagnostics": ["2 a 4 exames/achados ou critérios que confirmam ou são chave no diagnóstico"],
  "management": "linhas gerais de tratamento / primeira linha, em 1-2 frases",
  "pearl": "1 pérola clínica de alto valor ou armadilha a evitar (o erro comum)"
}`
}
