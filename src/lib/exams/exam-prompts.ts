import type { Patient } from '@/types/domain'

export function buildExamValidationPrompt(
  patient: Patient,
  examName: string,
  justification: string,
  clinicalReasoning: string,
  physicalExamSummary: string
): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'

  return `Você é um supervisor clínico. Avalie se a solicitação de exame é clinicamente justificada.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.specialty}
Queixa: ${patient.chief_complaint}
Condições: ${conditions}
Exame físico resumido: ${physicalExamSummary || '(não realizado)'}
Pensamento clínico: ${clinicalReasoning || '(não registrado)'}

Exame solicitado: ${examName}
Justificativa do aluno: ${justification}

Responda APENAS com JSON válido:
{
  "approved": true,
  "feedback": "frase curta explicando por que foi aprovado ou rejeitado"
}`
}

export function buildExamResultPrompt(patient: Patient, examName: string): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'

  return `Você é um sistema de laudo médico simulado. Gere um resultado realista para o exame abaixo, compatível com o quadro clínico do paciente.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.gender === 'M' ? 'masculino' : 'feminino'}
Queixa: ${patient.chief_complaint}
Condições: ${conditions}
Dificuldade do caso: ${patient.difficulty}

Exame: ${examName}

Regras:
- Nível easy: resultado claramente compatível com o diagnóstico esperado
- Nível medium: resultado com 1-2 achados que requerem interpretação
- Nível hard: resultado com achados sutis ou atípicos

Gere apenas o texto do laudo, como um laudo real. Sem JSON, sem explicação.`
}
