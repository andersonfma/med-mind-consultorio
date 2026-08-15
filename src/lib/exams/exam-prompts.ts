import type { Patient } from '@/types/domain'

// Mensagem mostrada ao aluno quando um exame é REJEITADO. É fixa e genérica de propósito:
// o texto livre do juiz costuma citar a hipótese/diagnóstico ("não condiz com Raynaud..."),
// o que estragaria o caso. Exame APROVADO não recebe feedback nenhum (o badge já basta) —
// justamente para não revelar o diagnóstico na justificativa do aceite.
export const EXAM_REJECTION_FEEDBACK =
  'Justificativa sem nexo clínico suficiente com o caso. Revise e tente novamente.'

export function buildExamValidationPrompt(
  patient: Patient,
  examName: string,
  justification: string,
  clinicalReasoning: string,
  physicalExamSummary: string,
  caseSummary?: string | null,
  isFollowUp = false
): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'

  const memorySection = caseSummary && caseSummary.trim()
    ? `\nMEMÓRIA DO CASO (consultas anteriores):\n${caseSummary}`
    : ''

  const followUpRule = isFollowUp
    ? `\n- CONSULTA DE RETORNO: exames de monitoramento/controle/seguimento de um tratamento já iniciado ou de um diagnóstico em investigação (ver memória do caso) são VÁLIDOS, mesmo sem relação direta com a queixa inicial. Ex: repetir função renal/eletrólitos após iniciar diurético; repetir hemoglobina glicada para acompanhar controle glicêmico; reavaliar imagem para resposta ao tratamento.`
    : ''

  return `Você é um supervisor clínico. Avalie se a solicitação de exame é clinicamente justificada.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.specialty}
Queixa: ${patient.chief_complaint}
Condições: ${conditions}
Exame físico resumido: ${physicalExamSummary || '(não realizado)'}
Pensamento clínico: ${clinicalReasoning || '(não registrado)'}${memorySection}

Exame solicitado: ${examName}
Justificativa do aluno: ${justification}

Critérios de aprovação (supervisor CRITERIOSO: a barra depende da PROPORCIONALIDADE do exame ao caso):

1) Exames de 1ª/2ª linha — baixo custo, não invasivos (hemograma, bioquímica, eletrólitos, função renal/hepática, sorologias, FAN, urina/EAS, ECG, radiografia simples, ultrassonografia, ecocardiograma): a barra é BAIXA. Aprove com QUALQUER nexo clínico plausível — relação com a queixa, uma hipótese diagnóstica, um achado do exame físico (ex: sopro/turgência → ecocardiograma), as condições do paciente, ou rastreio/prevenção. Justificativa curta que cita um achado, sintoma ou hipótese razoável JÁ basta; não exija texto longo nem perfeito. Na dúvida, aprove.

2) Exames de ALTA COMPLEXIDADE — alto custo, invasivos ou de 3ª linha (PET-CT, cintilografia, ressonância magnética, tomografia com contraste, biópsia, angiografia/cateterismo, endoscopia/colonoscopia, punção/análise de líquor, testes genéticos): a barra é ALTA, MAS o que decide NÃO é o custo em si — é se o exame MIRA UM ACHADO CONCRETO do caso ou se é uma varredura exploratória.
   - APROVE quando o exame avalia DIRETAMENTE um achado concreto já presente no caso: uma lesão/úlcera/massa/nódulo visível ou palpável a ser amostrado (ex: úlcera oral em suspeita de Behçet → BIÓPSIA da úlcera; lesão de pele suspeita → biópsia; massa → biópsia guiada), um órgão/região implicado por um achado do exame físico, ou uma hipótese DEFINIDA cuja confirmação muda a conduta e que só aquele exame fecha. Aqui a INDICAÇÃO ESPECÍFICA está presente — o exame examina o próprio achado que se apresenta. APROVE.
   - REPROVE quando o uso é EXPLORATÓRIO / pescaria: nexo genérico e SEM alvo concreto ("investigar autoimune", "descartar neoplasia em geral", "possível Sjögren", "para avaliar melhor", "rastrear tudo"), ou um exame caro pedido para uma dúvida ampla que exames de 1ª linha ainda nem começaram a estreitar. → "approved": false.
   - Em resumo: exame caro/invasivo que AMOSTRA OU EXAMINA o achado concreto que se apresenta = indicado (aprove); o mesmo exame usado como varredura ampla sem alvo definido = desproporcional (reprove). Na presença de um achado-alvo claro, NÃO exija que exames de 1ª linha venham antes.

3) Reprove SEMPRE que o exame não tiver NENHUM nexo clínico nem preventivo com o caso (área totalmente alheia à queixa, sem rastreio) → "approved": false.${followUpRule}

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
    ? `\nDIAGNÓSTICO VERDADEIRO DO CASO (contexto interno, não é o exame pedido): ${trueDiagnosis}
COMO USAR O DIAGNÓSTICO: ele influencia APENAS os VALORES dos parâmetros que JÁ pertencem ao exame "${examName}". Ex: se o exame for "${examName}" e algum de seus parâmetros próprios for tipicamente alterado por este diagnóstico, ajuste o VALOR desse parâmetro.
PROIBIÇÃO ABSOLUTA: NUNCA adicione um parâmetro que não pertence ao exame "${examName}" só porque é "relevante ao diagnóstico" (ex: NÃO coloque HbA1c, glicemia ou lipídios dentro de um exame que não os mede). NUNCA substitua o exame pedido por um painel metabólico/bioquímico do diagnóstico. Se NENHUM parâmetro próprio de "${examName}" for afetado pelo diagnóstico, retorne valores normais — está CORRETO um exame vir normal.`
    : ''

  return `Você é um sistema de laudo médico simulado. Gere o resultado do exame solicitado.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.gender === 'M' ? 'masculino' : 'feminino'}
Queixa: ${patient.chief_complaint}
Condições: ${conditions}
Dificuldade do caso: ${patient.difficulty}${diagnosisAnchor}

Exame solicitado: ${examName}

REGRA MAIS IMPORTANTE — ESCOPO DO EXAME:
- Gere o laudo de UM ÚNICO exame: exatamente "${examName}". NUNCA produza um segundo exame, bloco ou painel adicional, mesmo que pareça relacionado. Uma solicitação = um laudo.
- PRIMEIRO identifique (apenas para si, não imprima a expansão) o que é o exame "${examName}" e qual seu conjunto PADRÃO de parâmetros. Reconheça siglas brasileiras: FAN = Fator Antinuclear (qualitativo: reagente/não reagente + título + padrão); EAS/EQU = urina tipo 1 / sedimento urinário; TGO/TGP = transaminases; EPF = parasitológico de fezes; PCR = proteína C reativa; VHS = velocidade de hemossedimentação. Use isto SOMENTE para identificar o exame pedido e então emita o laudo APENAS dele.
- Inclua TODOS e EXCLUSIVAMENTE os parâmetros que pertencem ao exame "${examName}" e a NENHUM outro exame. NÃO adicione exames complementares, parâmetros de outros exames, nem "achados relacionados".
- COERÊNCIA DE AMOSTRA: os parâmetros devem corresponder ao TIPO DE MATERIAL do exame. Exame de URINA (EAS) contém SOMENTE parâmetros urinários (aspecto, cor, densidade, pH, proteínas, glicose, corpos cetônicos, nitrito, urobilinogênio, leucócitos, hemácias, cilindros, cristais) — NUNCA parâmetros de sangue (HbA1c, creatinina sérica, transaminases). Exame de sangue não traz parâmetros de urina.
- Exames QUALITATIVOS/sorológicos têm formato próprio: FAN → "Resultado: Reagente/Não reagente | Título: 1:X | Padrão: ...". Não force valores numéricos de bioquímica neles.
- Exemplos de escopo correto:
  • "Hemograma completo" → APENAS série vermelha (Hb, Ht, VCM, HCM, CHCM, RDW), série branca (leucócitos totais + diferencial) e plaquetas. NUNCA inclua TSH, ferritina, LDH, vitaminas, bioquímica ou hormônios.
  • "TSH" → SOMENTE o valor de TSH. Nada mais.
  • "Vitamina B12" → SOMENTE dosagem de vitamina B12. Não inclua ácido fólico, homocisteína, TSH nem anti-TPO, a menos que o nome do exame os mencione explicitamente.
- Se o exame nomeado for um painel reconhecido (ex: "Perfil lipídico", "Função hepática"), inclua apenas os componentes padrão DESSE painel.

Regras por dificuldade:
- easy: resultado claramente compatível com o diagnóstico
- medium: 1-2 achados que requerem raciocínio clínico para interpretar
- hard: alterações sutis ou atípicas que podem confundir

REGRAS DE FORMATO:
- Retorne SOMENTE os valores brutos do exame (parâmetro, valor e valor de referência), como num laudo real.
- PROIBIDO incluir: "Impressão", "Conclusão", "Comentário", "Observação", "Nota", "Interpretação", "Considerações", "Sugere-se", "Compatível com", "Achados sugestivos de", ou qualquer frase interpretativa. O aluno interpreta sozinho.
- Não repita o nome/idade do paciente no laudo.
- Sem formatação markdown — NÃO use asteriscos, #, ** ou tabelas. Apenas texto simples com quebras de linha.
- Sem JSON.`
}
