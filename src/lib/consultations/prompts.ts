import type { Patient } from '@/types/domain'

export type ChatMessage = {
  role: 'student' | 'patient'
  content: string
  timestamp: string
}

export function buildPatientSystemPrompt(patient: Patient): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'

  return `Você é um paciente simulado para treinamento médico. Responda APENAS como o paciente, na primeira pessoa. Nunca quebre o personagem ou mencione que é uma simulação.

Nome: ${patient.name}
Idade: ${patient.age} anos
Gênero: ${patient.gender === 'M' ? 'Masculino' : 'Feminino'}
Especialidade: ${patient.specialty}
Queixa principal: ${patient.chief_complaint}
Estado clínico: ${patient.clinical_status}
Condições preexistentes: ${conditions}
Dificuldade: ${patient.difficulty}

Regras por dificuldade:
- easy: fale de forma clara e objetiva
- medium: seja moderadamente vago, forneça informações aos poucos
- hard: seja impreciso, confunda datas, minimize sintomas

Responda de forma concisa (1-3 frases).`
}

export function buildAnamnesisPrompt(chatHistory: ChatMessage[]): string {
  const conversation = chatHistory
    .map(m => `${m.role === 'student' ? 'Médico' : 'Paciente'}: ${m.content}`)
    .join('\n')

  return `Analise a conversa abaixo entre um médico e um paciente e extraia as informações para cada seção da anamnese. Se uma seção não tiver informações suficientes, deixe como string vazia.

Responda APENAS com JSON válido:
{
  "hda": "História da Doença Atual",
  "hpp": "História Patológica Pregressa",
  "ad": "Antecedentes e Doenças",
  "social": "História Social",
  "familiar": "História Familiar"
}

Conversa:
${conversation}`
}

export function buildFinishPrompt(
  patient: Patient,
  diagnosis: string,
  clinicalReasoning: string
): string {
  return `Você é um sistema de simulação médica. Uma consulta foi realizada.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.specialty}
Queixa inicial: ${patient.chief_complaint}
Estado clínico anterior: ${patient.clinical_status}
Diagnóstico proposto pelo aluno: ${diagnosis}
Pensamento clínico registrado: ${clinicalReasoning || '(não registrado)'}

Gere uma frase curta descrevendo o novo estado clínico do paciente após esta consulta, considerando o diagnóstico proposto. Se o diagnóstico parecer razoável, melhore o estado. Se parecer inadequado, mantenha ou piore levemente.

Responda APENAS com a frase do estado clínico (sem JSON, sem explicação).`
}
