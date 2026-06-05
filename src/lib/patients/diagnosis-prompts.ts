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
1. Determine qual seria o diagnóstico verdadeiro mais provável para este paciente simulado, considerando o perfil clínico acima.
2. Avalie se o diagnóstico do aluno é clinicamente compatível com o diagnóstico verdadeiro (aceite variações de terminologia, especificidade, ou diagnóstico sindrômico equivalente).

Responda APENAS com JSON válido:
{
  "true_diagnosis": "diagnóstico verdadeiro em termos médicos precisos",
  "compatible": true,
  "reasoning": "frase curta explicando se é compatível ou não"
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
