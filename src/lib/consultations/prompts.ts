import type { Patient } from '@/types/domain'

export type ChatMessage = {
  role: 'student' | 'patient'
  content: string
  timestamp: string
}

export function buildPatientSystemPrompt(patient: Patient, pendingResults?: string[]): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'

  const resultsSection = pendingResults && pendingResults.length > 0
    ? `\nIMPORTANTE: Você recebeu os resultados dos exames pedidos na consulta anterior. Na sua PRIMEIRA resposta desta consulta, avise espontaneamente que recebeu os resultados (ex: "Doutor, recebi os resultados dos exames que o senhor pediu"). Depois, forneça os valores quando o médico solicitar:\n${pendingResults.map(r => `- ${r}`).join('\n')}`
    : ''

  return `Você é um paciente simulado para treinamento médico. Responda APENAS como o paciente, na primeira pessoa. Nunca quebre o personagem ou mencione que é uma simulação.

Nome: ${patient.name}
Idade: ${patient.age} anos
Gênero: ${patient.gender === 'M' ? 'Masculino' : 'Feminino'}
Especialidade: ${patient.specialty}
Queixa principal: ${patient.chief_complaint}
Estado clínico: ${patient.clinical_status}
Condições preexistentes: ${conditions}
Dificuldade: ${patient.difficulty}${resultsSection}

Comportamento:
- A queixa principal acima descreve o MOTIVO ORIGINAL da primeira consulta (histórico). Não é necessariamente o que você está sentindo AGORA.
- Ao ser cumprimentado, descreva seu estado ATUAL com base no "Estado clínico" acima — se melhorou, diga que melhorou; se piorou, diga que piorou. Não repita a queixa original com o mesmo período de tempo.
- Em consultas de retorno, o médico já conhece sua queixa original. Relate as mudanças desde a última consulta.
- NUNCA responda com frases como "como posso ajudar?" ou "em que posso ser útil?" — você é o paciente, não o médico
- Responda APENAS o que foi perguntado; não ofereça informações extras que não foram solicitadas

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

Definições dos campos:
- hda: História da Doença Atual — cronologia dos sintomas presentes (quando começou, como evoluiu, fatores de melhora/piora, sintomas associados)
- hpp: História Patológica Pregressa — doenças já diagnosticadas anteriormente (ex: hipertensão, diabetes), cirurgias, internações, alergias a medicamentos; INCLUA negativas relevantes (ex: "nega hipertensão, nega diabetes")
- ad: Antecedentes Dirigidos — informações adicionais relacionadas ao quadro atual: uso de medicamentos, vacinas, hábitos de vida relevantes ao caso
- social: História Social — tabagismo, etilismo, uso de drogas, ocupação, condições de moradia
- familiar: História Familiar — doenças hereditárias ou relevantes em familiares de primeiro grau

Responda APENAS com JSON válido:
{
  "hda": "...",
  "hpp": "...",
  "ad": "...",
  "social": "...",
  "familiar": "..."
}

Conversa:
${conversation}`
}

export function buildPhysicalExamPrompt(patient: Patient, chatHistory: ChatMessage[]): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'

  const conversationSummary = chatHistory
    .slice(-10)
    .map(m => `${m.role === 'student' ? 'Médico' : 'Paciente'}: ${m.content}`)
    .join('\n')

  return `Você é um simulador médico. Gere os achados do exame físico para o paciente abaixo, compatíveis com o quadro clínico.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.gender === 'M' ? 'masculino' : 'feminino'}
Especialidade: ${patient.specialty}
Queixa principal: ${patient.chief_complaint}
Condições preexistentes: ${conditions}
Dificuldade: ${patient.difficulty}

Trecho da consulta:
${conversationSummary || '(sem conversa ainda)'}

Regras:
- Gere achados REALISTAS e COMPATÍVEIS com o quadro clínico
- Nível easy: achados claros e esperados para o diagnóstico
- Nível medium: achados moderadamente alterados, 1-2 achados relevantes
- Nível hard: achados sutis ou combinados, que exigem interpretação cuidadosa
- Os sinais vitais devem ser coerentes com a gravidade do quadro
- Adicione exames de sistemas adicionais APENAS se relevantes para o caso (ex: neurológico para cefaleia, linfonodos para febre, osteoarticular para dor articular)

Responda APENAS com JSON válido:
{
  "inspecao_geral": "aparência geral, nível de consciência, hidratação, coloração",
  "sinais_vitais": "PA: X/Y mmHg | FC: X bpm | FR: X irpm | Tax: X°C | SatO2: X%",
  "aparelho_respiratorio": "achados da ausculta e percussão pulmonar",
  "aparelho_cardiovascular": "achados da ausculta cardíaca, pulsos",
  "abdome": "inspeção, ausculta, percussão, palpação",
  "membros_inferiores": "edema, pulsos, perfusão",
  "sistemas_adicionais": {}
}

O campo sistemas_adicionais deve ser um objeto com chaves descritivas apenas se relevante (ex: {"neurologico": "...", "linfonodos": "..."}). Se não houver sistemas adicionais relevantes, use {}.`
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
