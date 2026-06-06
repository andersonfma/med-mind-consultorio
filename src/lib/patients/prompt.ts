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
Regras por dificuldade (a dificuldade refere-se à COMPLEXIDADE DIAGNÓSTICA, não apenas à vagueza da queixa):
- easy: diagnóstico comum e prevalente, quadro clássico de manual, raciocínio direto (ex: pneumonia comunitária típica, ITU não complicada, enxaqueca). Sem comorbidades ou no máximo 1 leve.
- medium: diagnóstico moderadamente complexo, com 1-2 diagnósticos diferenciais plausíveis a considerar; 1-2 comorbidades. Exige investigação dirigida.
- hard: diagnóstico DESAFIADOR — condição menos prevalente, atípica, sistêmica ou que exige ampla investigação e exclusão (ex: doenças autoimunes, endocrinopatias raras, neoplasias ocultas, doenças infecciosas atípicas). NÃO use diagnósticos triviais (cistite, faringite, gripe) em casos hard. Múltiplas comorbidades que confundem o quadro.

REGRAS DE COMORBIDADE (conditions):
- As comorbidades devem ser PLAUSÍVEIS PARA A IDADE. NÃO atribua hipertensão e diabetes a pacientes jovens (< 40 anos) de forma automática.
- Pacientes jovens geralmente têm POUCAS ou NENHUMA comorbidade.
- Varie as comorbidades de acordo com o perfil: jovens podem ter asma, ansiedade, tireoidopatia; idosos podem ter HAS, DM, DPOC, etc.
- conditions pode ser uma lista vazia [] — não force comorbidades.

IMPORTANTE: Escolha o diagnóstico verdadeiro PRIMEIRO (respeitando a complexidade da dificuldade), depois construa o caso clínico de forma consistente com ele. O chief_complaint, clinical_status e conditions devem ser compatíveis com o true_diagnosis escolhido.

Responda APENAS com JSON válido, sem texto adicional:
{
  "name": "nome fictício brasileiro",
  "age": número inteiro entre 18 e 80,
  "gender": "M" ou "F",
  "chief_complaint": "queixa principal em 1 frase, na voz do paciente, compatível com o diagnóstico",
  "clinical_status": "estado clínico inicial em 1 frase curta, na voz do sistema",
  "conditions": ["comorbidades preexistentes relevantes ao caso"],
  "true_diagnosis": "diagnóstico médico preciso e fechado (ex: Colite Microscópica, IAM sem supra, DPOC em exacerbação)"
}`,
    }],
  }
}
