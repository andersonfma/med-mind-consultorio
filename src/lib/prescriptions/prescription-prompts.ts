import type { Patient } from '@/types/domain'
import type { ConductKind } from './types'

const ITEM_LABEL: Record<ConductKind, string> = {
  medicamento: 'Medicamento',
  procedimento: 'Procedimento',
  medida: 'Medida não-farmacológica',
}

export function buildPrescriptionEvalPrompt(
  patient: Patient,
  drugName: string,
  posology: string,
  justification: string | null,
  caseSummary?: string | null,
  kind: ConductKind = 'medicamento',
): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'
  const trueDiag = (patient as Record<string, unknown>).true_diagnosis as string | null
  const memory = caseSummary && caseSummary.trim() ? `\nMEMÓRIA DO CASO:\n${caseSummary}` : ''
  const isMed = kind === 'medicamento'
  const detailLabel = isMed ? 'Posologia' : 'Detalhamento'
  const focusLine = isMed
    ? 'O foco é a ESCOLHA do fármaco para o caso, não a casa decimal da dose.'
    : 'O foco é se o procedimento/medida é indicado e seguro para o caso.'

  return `Você é um supervisor clínico. Avalie a ADEQUAÇÃO de um item de conduta ao caso.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.specialty}
Queixa: ${patient.chief_complaint}
Condições: ${conditions}
Diagnóstico verdadeiro do caso (contexto interno): ${trueDiag ?? '(não definido)'}${memory}

Item de conduta do aluno:
- Tipo: ${ITEM_LABEL[kind]}
- ${isMed ? 'Medicamento' : 'Item'}: ${drugName}
- ${detailLabel}: ${posology}
- Justificativa: ${justification ?? '(não informada)'}

Classifique a adequação em UMA das três faixas:
- "adequada": item apropriado para o diagnóstico/quadro.
- "parcial": escolha defensável mas com ressalva (segunda linha, indicação incompleta, falta algo importante).
- "inadequada": item sem indicação para o caso, contraindicado, ou que pode causar dano.

Considere a segurança (contraindicações óbvias para as condições do paciente). ${focusLine}

REGRA CRÍTICA — NÃO REVELE O DIAGNÓSTICO: use o diagnóstico verdadeiro APENAS internamente, para decidir a adequação. É PROIBIDO nomear, citar ou insinuar o diagnóstico verdadeiro (ou a entidade/doença específica) no campo "feedback". O aluno ainda está descobrindo o caso — revelar o diagnóstico estraga a simulação. Redija o feedback em termos do QUADRO/QUEIXA e da SEGURANÇA, NUNCA em termos da doença de base.

Responda APENAS com JSON válido:
{
  "adequacy": "adequada" | "parcial" | "inadequada",
  "feedback": "1-2 frases pedagógicas explicando a classificação"
}`
}
