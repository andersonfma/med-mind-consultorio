import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import type { Specialty, Difficulty } from './specialties'

export function buildPatientPrompt(
  specialty: Specialty,
  difficulty: Difficulty,
  existingComplaints: string[] = []
): ChatCompletionCreateParamsNonStreaming {
  const avoidSection = existingComplaints.length > 0
    ? `\nIMPORTANTE — Variedade: o aluno já tem pacientes com as seguintes queixas principais:\n${existingComplaints.map(c => `- "${c}"`).join('\n')}\nGere um paciente com queixa E síndrome COMPLETAMENTE DIFERENTE das listadas acima. Evite qualquer sobreposição de sintoma principal (não usar falta de ar, cansaço, dor no peito se já existem; use cefaleias, sintomas GI, urinários, osteoarticulares, neurológicos, endócrinos, etc.).\n`
    : ''

  return {
    model: 'gpt-4o-mini' as const,
    response_format: { type: 'json_object' as const },
    messages: [{
      role: 'user' as const,
      content: `Você é um gerador de pacientes simulados para treinamento médico.
Gere um paciente realista para a especialidade: ${specialty}.
Nível de dificuldade: ${difficulty}.
${avoidSection}
Regras por dificuldade:
- easy: queixa clara, quadro típico, sem comorbidades relevantes
- medium: queixa moderadamente vaga, 1-2 comorbidades
- hard: queixa inespecífica, múltiplas comorbidades, quadro atípico

Responda APENAS com JSON válido, sem texto adicional:
{
  "name": "nome fictício brasileiro",
  "age": número inteiro entre 18 e 80,
  "gender": "M" ou "F",
  "chief_complaint": "queixa principal em 1 frase, na voz do paciente",
  "clinical_status": "estado clínico inicial em 1 frase curta, na voz do sistema",
  "conditions": ["lista", "de", "condições", "preexistentes"]
}`,
    }],
  }
}
