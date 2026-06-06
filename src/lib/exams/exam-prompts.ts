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

Critérios de aprovação:
- Exames diretamente relacionados à queixa ou hipótese diagnóstica: aprovar se a justificativa for razoável
- Exames de rastreio/prevenção (ex: colonoscopia para rastreio colorretal, mamografia, PSA, densitometria): aprovar se o aluno mencionar rastreio ou prevenção como justificativa — mesmo sem relação com a queixa principal
- Rejeitar apenas quando o exame não tem qualquer relação clínica ou preventiva com o caso E a justificativa for inadequada

Responda APENAS com JSON válido:
{
  "approved": true,
  "feedback": "frase curta explicando por que foi aprovado ou rejeitado"
}`
}

export function buildExamResultPrompt(patient: Patient, examName: string, trueDiagnosis?: string | null): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'

  const diagnosisAnchor = trueDiagnosis
    ? `\nDIAGNÓSTICO VERDADEIRO DO CASO: ${trueDiagnosis}\nOs resultados DEVEM ser compatíveis com este diagnóstico. Se o exame for específico para ele (ex: Dix-Hallpike para VPPB, painel viral para infecção viral), o resultado deve confirmá-lo ou ser coerente com ele.`
    : ''

  return `Você é um sistema de laudo médico simulado. Gere um resultado realista para o exame abaixo, compatível com o quadro clínico do paciente.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.gender === 'M' ? 'masculino' : 'feminino'}
Queixa: ${patient.chief_complaint}
Condições: ${conditions}
Dificuldade do caso: ${patient.difficulty}${diagnosisAnchor}

Exame: ${examName}

Regras por dificuldade:
- easy: resultado claramente compatível com o diagnóstico
- medium: 1-2 achados que requerem raciocínio clínico para interpretar
- hard: alterações sutis ou atípicas que podem confundir

IMPORTANTE: Retorne APENAS os valores brutos do exame, no formato de um laudo laboratorial ou de imagem. NÃO inclua impressão diagnóstica, interpretação, considerações finais, conclusão ou qualquer texto além dos resultados. Sem JSON, sem explicação. Sem formatação markdown — NÃO use asteriscos, traços de tabela, #, **, ou qualquer símbolo de formatação. Use apenas texto simples com quebras de linha.`
}
