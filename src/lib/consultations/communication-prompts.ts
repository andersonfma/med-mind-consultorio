import type { Patient } from '@/types/domain'
import type { ChatMessage } from './prompts'

export function buildCommunicationPrompt(patient: Patient, chatHistory: ChatMessage[]): string {
  const conversation = chatHistory.length > 0
    ? chatHistory.map(m => `${m.role === 'student' ? 'Médico' : 'Paciente'}: ${m.content}`).join('\n')
    : '(sem conversa)'

  return `Você é um avaliador de COMUNICAÇÃO médico-paciente. Avalie a QUALIDADE DO DIÁLOGO do aluno (médico) com o paciente nesta consulta simulada.

REGRA DE INDEPENDÊNCIA (CRÍTICA): a nota é INDEPENDENTE de o aluno ter acertado o diagnóstico ou de a conduta clínica ser correta — isso é avaliado em outro lugar. NÃO premie nem penalize pelo acerto clínico; avalie APENAS COMO o aluno se comunicou.

CASO:
Paciente: ${patient.name}, ${patient.age} anos. Queixa: ${patient.chief_complaint}.

CONVERSA (médico-paciente):
${conversation}

EIXOS A AVALIAR (nota inteira de 0 a 10 cada):
- C1 (Clareza & linguagem) — adequação dos termos técnicos à compreensão do paciente e clareza. Nota alta: explica em linguagem acessível, evita jargão sem traduzir, perguntas e orientações claras. Nota baixa: despeja termos técnicos que o paciente leigo não entenderia, perguntas confusas.
- C2 (Empatia & acolhimento) — escuta e validação do que o paciente sente. Nota alta: acolhe, valida a preocupação, tom humano. Nota baixa: frio, ignora o que o paciente traz, mecânico.
- C3 (Condução da entrevista) — organização e ritmo. Nota alta: cumprimenta, abre com pergunta aberta e afunila, deixa o paciente falar sem atropelar, fecha orientando. Nota baixa: interrogatório atropelado, não deixa o paciente responder, desorganizado.

CALIBRAÇÃO DA ESCALA (use toda a escala, não concentre em 7-8):
0-2 falha grave/ausente · 3-4 fraco · 5-6 adequado · 7-8 bom · 9-10 excelente.
Se houver POUCA conversa observável, dê nota BAIXA — ausência de diálogo é nota baixa, não média.

RECOMENDAÇÃO: um único texto formativo curto (2 a 4 frases), em português, dirigido ao aluno ("você..."), focando a faceta de MENOR nota — nomeie a falha específica de comunicação e o que fazer diferente. Tom de coaching.

Responda APENAS com JSON válido, sem texto adicional:
{
  "c1": número inteiro 0-10,
  "c2": número inteiro 0-10,
  "c3": número inteiro 0-10,
  "recommendation": "texto da recomendação"
}`
}
