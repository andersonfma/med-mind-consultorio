import type { Patient } from '@/types/domain'

export function buildPrescriptionEvalPrompt(
  patient: Patient,
  drugName: string,
  posology: string,
  justification: string | null,
  caseSummary?: string | null,
): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'
  const trueDiag = (patient as Record<string, unknown>).true_diagnosis as string | null
  const memory = caseSummary && caseSummary.trim() ? `\nMEMÓRIA DO CASO:\n${caseSummary}` : ''

  return `Você é um supervisor clínico. Avalie a ADEQUAÇÃO de uma prescrição ao caso.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.specialty}
Queixa: ${patient.chief_complaint}
Condições: ${conditions}
Diagnóstico verdadeiro do caso (contexto interno): ${trueDiag ?? '(não definido)'}${memory}

Prescrição do aluno:
- Medicamento: ${drugName}
- Posologia: ${posology}
- Justificativa: ${justification ?? '(não informada)'}

Classifique a adequação em UMA das três faixas:
- "adequada": medicamento apropriado para o diagnóstico/quadro, com posologia plausível.
- "parcial": escolha defensável mas com ressalva (posologia imprecisa, segunda linha, indicação incompleta, falta algo importante).
- "inadequada": medicamento sem indicação para o caso, contraindicado, ou que pode causar dano.

Considere a segurança (contraindicações óbvias para as condições do paciente). O foco é a ESCOLHA do fármaco para o caso, não a casa decimal da dose.

Responda APENAS com JSON válido:
{
  "adequacy": "adequada" | "parcial" | "inadequada",
  "feedback": "1-2 frases pedagógicas explicando a classificação"
}`
}
