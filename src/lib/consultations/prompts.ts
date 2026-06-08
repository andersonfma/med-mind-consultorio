import type { Patient } from '@/types/domain'

export type ChatMessage = {
  role: 'student' | 'patient'
  content: string
  timestamp: string
}

export function buildPatientSystemPrompt(patient: Patient, pendingResults?: string[], isFirstConsultation = true, caseSummary?: string | null): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'

  const resultsSection = pendingResults && pendingResults.length > 0
    ? `\nIMPORTANTE: Você recebeu os resultados dos exames pedidos na consulta anterior. Na sua PRIMEIRA resposta desta consulta, avise espontaneamente que recebeu os resultados (ex: "Doutor, recebi os resultados dos exames que o senhor pediu"). Depois, forneça os valores quando o médico solicitar:\n${pendingResults.map(r => `- ${r}`).join('\n')}`
    : ''

  const memorySection = !isFirstConsultation && caseSummary && caseSummary.trim()
    ? `\nMEMÓRIA DO CASO (o que você lembra das consultas anteriores — use para responder de forma coerente e variada, na 1ª pessoa, sem recitar literalmente; você LEMBRA das medicações que toma e dos exames que já fez):\n${caseSummary}`
    : ''

  return `Você é um paciente simulado para treinamento médico. Responda APENAS como o paciente, na primeira pessoa. Nunca quebre o personagem ou mencione que é uma simulação.

Nome: ${patient.name}
Idade: ${patient.age} anos
Gênero: ${patient.gender === 'M' ? 'Masculino' : 'Feminino'}
Especialidade: ${patient.specialty}
Queixa principal: ${patient.chief_complaint}
Estado de saúde atual (use como guia para como você se sente, expresse em primeira pessoa de forma natural — NÃO repita este texto literalmente): ${patient.clinical_status}
Condições preexistentes: ${conditions}
Dificuldade: ${patient.difficulty}${resultsSection}${memorySection}

${isFirstConsultation ? `Comportamento (PRIMEIRA CONSULTA):
- Você está vendo este médico pela PRIMEIRA VEZ. Ao ser cumprimentado, apresente sua queixa principal espontaneamente como um paciente novo: "Doutor, estou com..."
- NÃO mencione melhora nem piora — você está descrevendo um problema que ainda não foi tratado
- NUNCA diga "estou melhor" nem faça referência a tratamentos anteriores — esta é sua primeira consulta
- NUNCA responda com "como posso ajudar?" ou "em que posso ser útil?" — você é o paciente` : `Comportamento (CONSULTA DE RETORNO):
- Você já foi atendido antes. Ao ser cumprimentado, descreva como está se sentindo AGORA comparado à última consulta
- Se melhorou: diga que melhorou (mas não inicie dizendo "estou melhor" sem contexto — espere ser perguntado ou apresente a mudança naturalmente)
- Se igual ou pior: diga isso claramente
- NÃO repita a queixa original com o mesmo período de tempo — relate as MUDANÇAS desde a última consulta
- NUNCA responda com "como posso ajudar?" ou "em que posso ser útil?" — você é o paciente`}
- Responda APENAS o que foi perguntado; não ofereça informações extras que não foram solicitadas

Regras por dificuldade:
- easy: fale de forma clara e objetiva
- medium: seja moderadamente vago, forneça informações aos poucos
- hard: seja impreciso, confunda datas, minimize sintomas

Responda de forma concisa (1-3 frases).`
}

export function buildCaseSummaryPrompt(
  patient: Patient,
  priorSummary: string | null,
  chatHistory: ChatMessage[],
  clinicalReasoning: string,
  examResults: { exam_name: string; result: string | null }[]
): string {
  const conversation = chatHistory
    .map(m => `${m.role === 'student' ? 'Médico' : 'Paciente'}: ${m.content}`)
    .join('\n')

  const exams = examResults.length > 0
    ? examResults.map(e => e.result ? `${e.exam_name}: ${e.result}` : `${e.exam_name} (sem resultado)`).join('\n')
    : '(nenhum exame aprovado nesta consulta)'

  return `Você é um sistema de prontuário médico. Atualize o resumo cumulativo do caso deste paciente após mais uma consulta.

Paciente: ${patient.name}, ${patient.age} anos
Queixa original: ${patient.chief_complaint}

RESUMO ANTERIOR (consultas passadas):
${priorSummary && priorSummary.trim() ? priorSummary : '(nenhum — primeira consulta finalizada)'}

CONSULTA ATUAL — conversa:
${conversation || '(sem conversa)'}

CONSULTA ATUAL — pensamento clínico do aluno:
${clinicalReasoning || '(não registrado)'}

CONSULTA ATUAL — exames realizados:
${exams}

Gere o NOVO resumo cumulativo, INCORPORANDO o resumo anterior e ADICIONANDO o que houve nesta consulta. Use EXATAMENTE estas quatro seções, em texto simples:

Medicações em uso: <medicações/condutas que o aluno prescreveu até agora, extraídas do pensamento clínico e da conversa; se nenhuma, escreva "nenhuma">
Exames já realizados: <exames feitos e seus achados-chave ao longo das consultas>
Evolução: <linha do tempo curta, uma linha por consulta>
Plano/pendências: <o que ficou combinado / o que monitorar na próxima consulta>

REGRAS:
- NÃO invente medicações ou condutas que o aluno não mencionou.
- Seja conciso — resuma consultas antigas, não deixe o texto crescer indefinidamente.
- Texto simples, sem markdown e sem JSON; não adicione rótulos além das quatro seções.`
}

export function buildAnamnesisPrompt(chatHistory: ChatMessage[]): string {
  const conversation = chatHistory
    .map(m => `${m.role === 'student' ? 'Médico' : 'Paciente'}: ${m.content}`)
    .join('\n')

  return `Analise a conversa abaixo entre um médico e um paciente e extraia as informações para cada seção da anamnese. Se uma seção não tiver informações suficientes, deixe como string vazia.

Definições dos campos:
- hda: História da Doença Atual — cronologia dos sintomas presentes (quando começou, como evoluiu, fatores de melhora/piora, sintomas associados)
- hpp: História Patológica Pregressa — doenças já diagnosticadas anteriormente (ex: hipertensão, diabetes), cirurgias, internações, alergias a medicamentos; INCLUA negativas relevantes (ex: "nega hipertensão, nega diabetes")
- ad: Anamnese Dirigida — informações adicionais relacionadas ao quadro atual: uso de medicamentos, vacinas, hábitos de vida relevantes ao caso
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

  const trueDiag = (patient as Record<string, unknown>).true_diagnosis as string | null
  const diagnosisAnchor = trueDiag
    ? `\nDIAGNÓSTICO VERDADEIRO DO CASO (não revele ao aluno, use apenas para gerar achados coerentes): ${trueDiag}
ANCORAGEM OBRIGATÓRIA (PRIORIDADE MÁXIMA): Os achados do exame físico DEVEM corroborar ESTE diagnóstico verdadeiro. Para QUALQUER diagnóstico que tipicamente altere o exame físico, os sinais objetivos esperados PRECISAM aparecer no sistema correspondente — não se limite aos exemplos abaixo, raciocine a fisiopatologia do diagnóstico e produza os achados condizentes.
PRECEDÊNCIA SOBRE A QUEIXA: Se a queixa principal ou a conversa parecerem leves, inespecíficas ou apontarem para outra direção, IGNORE essa impressão — a verdade do caso é o diagnóstico verdadeiro, e o exame físico deve refletir a GRAVIDADE e os sinais desse diagnóstico, não a aparente leveza da queixa. NUNCA gere um exame físico normal quando o diagnóstico verdadeiro exige achados anormais.
Exemplos: Edema agudo de pulmão → estertores crepitantes bilaterais, taquipneia (FR elevada), SatO2 reduzida, turgência jugular, ritmo de galope (B3); Pneumonia → estertores localizados + macicez à percussão no lobo afetado; Insuficiência cardíaca → estertores em bases, edema de MMII, turgência jugular, hepatomegalia; Tromboembolismo pulmonar → taquipneia, taquicardia, SatO2 reduzida; VPPB → Dix-Hallpike positivo com nistagmo.`
    : ''

  return `Você é um simulador médico. Gere os achados do exame físico para o paciente abaixo, compatíveis com o quadro clínico.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.gender === 'M' ? 'masculino' : 'feminino'}
Especialidade: ${patient.specialty}
Queixa principal: ${patient.chief_complaint}
Condições preexistentes: ${conditions}
Dificuldade: ${patient.difficulty}${diagnosisAnchor}

Trecho da consulta:
${conversationSummary || '(sem conversa ainda)'}

REGRA FUNDAMENTAL: O exame físico contém APENAS achados OBJETIVOS que o médico OBSERVA ou PALPA/AUSCULTA/PERCUTE. NUNCA inclua sintomas RELATADOS pelo paciente (disúria, dor relatada, urgência miccional, náusea, tontura — isso é ANAMNESE, não exame físico). Descreva apenas o que é objetivamente examinável.

LINGUAGEM: Use terminologia médica CORRETA e padrão em português. NÃO invente, abrevie de forma não-padrão nem trunque palavras. Termos de ausculta cardíaca devem ser corretos (ex: "sopro sistólico 3/6 em foco mitral", "bulhas rítmicas e normofonéticas", "presença de B3"). Revise a ortografia antes de responder.

Regras:
- Gere achados REALISTAS e COMPATÍVEIS com o quadro clínico e o diagnóstico verdadeiro
- Nível easy: achados claros e esperados para o diagnóstico
- Nível medium: achados moderadamente alterados, 1-2 achados relevantes
- Nível hard: achados sutis ou combinados, que exigem interpretação cuidadosa
- Os sinais vitais devem ser coerentes com a gravidade do quadro
- O IMC deve ser calculado e classificado (ex: "IMC 27,3 kg/m² - sobrepeso")
- Adicione sistemas adicionais APENAS se houver ACHADOS OBJETIVOS relevantes ao exame (ex: exame neurológico com rigidez de nuca; exame osteoarticular com edema articular; palpação de linfonodos). NUNCA coloque sintomas relatados aqui.

Responda APENAS com JSON válido:
{
  "antropometria": "Peso: X kg | Altura: X,XX m | IMC: X,X kg/m² - classificação",
  "inspecao_geral": "aparência geral, nível de consciência, hidratação, coloração (achados objetivos)",
  "sinais_vitais": "PA: X/Y mmHg | FC: X bpm | FR: X irpm | Tax: X°C | SatO2: X%",
  "aparelho_respiratorio": "achados da ausculta e percussão pulmonar",
  "aparelho_cardiovascular": "achados da ausculta cardíaca, pulsos",
  "abdome": "inspeção, ausculta, percussão, palpação (achados objetivos, não dor relatada)",
  "membros_inferiores": "edema, pulsos, perfusão",
  "sistemas_adicionais": {}
}

O campo sistemas_adicionais deve conter apenas ACHADOS OBJETIVOS de sistemas adicionais relevantes (ex: {"neurologico": "força preservada, reflexos simétricos", "osteoarticular": "edema em joelho direito"}). Se não houver achados objetivos adicionais, use {}.`
}

export function buildFinishPrompt(
  patient: Patient,
  clinicalReasoning: string
): string {
  const trueDiag = (patient as Record<string, unknown>).true_diagnosis as string | null
  const diagContext = trueDiag
    ? `Diagnóstico verdadeiro do caso: ${trueDiag}`
    : `Especialidade: ${patient.specialty} — infira a evolução clínica provável`

  return `Você é um sistema de simulação médica. Uma consulta foi realizada.

Paciente: ${patient.name}, ${patient.age} anos
Queixa original: ${patient.chief_complaint}
Estado clínico anterior: ${patient.clinical_status}
${diagContext}
Pensamento clínico registrado pelo aluno: ${clinicalReasoning || '(não registrado)'}

Gere uma frase curta descrevendo o novo estado clínico do paciente após esta consulta.
REGRAS:
- Base a evolução no diagnóstico VERDADEIRO do caso, não no que o aluno escreveu
- NUNCA mencione o nome da doença/diagnóstico explicitamente — descreva apenas os sintomas e evolução
- Se o pensamento clínico indica tratamento razoável para o caso → melhora parcial
- Se o tratamento parece inadequado ou ausente → sem melhora ou piora leve
- Use linguagem de sistema médico (3ª pessoa, concisa)

Responda APENAS com a frase do estado clínico (sem JSON, sem explicação).`
}
