import type { Patient } from '@/types/domain'
import type { Adequacy, ConductKind } from './types'

export type ConductItem = { drug_name: string; posology: string; kind: ConductKind }

const KIND_LABEL: Record<ConductKind, string> = {
  medicamento: 'medicamento',
  procedimento: 'procedimento',
  medida: 'medida',
}

/**
 * Avalia a adequação do CONJUNTO da conduta (fármacos + procedimentos + medidas)
 * contra o diagnóstico verdadeiro. É a nota GLOBAL — resolve o caso em que itens
 * isolados parecem parciais mas juntos formam a conduta correta (ex.: terlipressina
 * sozinha = parcial; terlipressina + ligadura + TIPS = adequada).
 */
export function buildConductEvalPrompt(patient: Patient, conduct: ConductItem[]): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'
  const trueDiag = (patient as Record<string, unknown>).true_diagnosis as string | null
  const list = conduct
    .map(c => `- [${KIND_LABEL[c.kind]}] ${c.drug_name} — ${c.posology}`)
    .join('\n')

  return `Você é um supervisor clínico. Avalie a ADEQUAÇÃO do CONJUNTO da conduta terapêutica ao caso.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.specialty}
Queixa: ${patient.chief_complaint}
Condições: ${conditions}
Diagnóstico verdadeiro do caso (contexto interno): ${trueDiag ?? '(não definido)'}

Conduta ativa do aluno (avalie como CONJUNTO, não item a item):
${list}

Avalie o conjunto como um todo e classifique em UMA faixa:
- "adequada": o conjunto trata corretamente o quadro/diagnóstico (mesmo que um item isolado, sozinho, fosse insuficiente).
- "parcial": conduta na direção certa, mas incompleta ou com ressalva relevante.
- "inadequada": conduta que não trata o caso, é contraindicada, ou pode causar dano.

REGRA CRÍTICA — NÃO REVELE O DIAGNÓSTICO: use o diagnóstico verdadeiro APENAS internamente para classificar. É PROIBIDO nomear, citar ou insinuar o diagnóstico/doença. Esta resposta alimenta a evolução clínica do sistema, não é mostrada ao aluno.

Responda APENAS com JSON válido:
{ "adequacy": "adequada" | "parcial" | "inadequada" }`
}

export function parseConductAdequacy(raw: string): Adequacy | null {
  let obj: Record<string, unknown>
  try { obj = JSON.parse(raw) as Record<string, unknown> }
  catch { return null }
  const a = obj.adequacy
  return a === 'adequada' || a === 'parcial' || a === 'inadequada' ? a : null
}
