import type { Patient } from '@/types/domain'

export function buildExamValidationPrompt(
  patient: Patient,
  examName: string,
  justification: string,
  clinicalReasoning: string,
  physicalExamSummary: string
): string {
  const conditions = Array.isArray(patient.conditions) && patient.conditions.length > 0
    ? (patient.conditions as string[]).join(', ')
    : 'nenhuma'

  return `Você é um supervisor clínico. Avalie se a solicitação de exame é clinicamente justificada.

Paciente: ${patient.name}, ${patient.age} anos, ${patient.specialty}
Queixa: ${patient.chief_complaint}
Condições: ${conditions}
Exame físico resumido: ${physicalExamSummary || '(não realizado)'}
Pensamento clínico: ${clinicalReasoning || '(não registrado)'}

Exame solicitado: ${examName}
Justificativa do aluno: ${justification}

Critérios de aprovação:
- Exames diretamente relacionados à queixa ou hipótese diagnóstica: aprovar se a justificativa for razoável
- Exames de rastreio/prevenção (ex: colonoscopia para rastreio colorretal, mamografia, PSA, densitometria): aprovar se o aluno mencionar rastreio ou prevenção como justificativa — mesmo sem relação com a queixa principal
- Rejeitar apenas quando o exame não tem qualquer relação clínica ou preventiva com o caso E a justificativa for inadequada

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
