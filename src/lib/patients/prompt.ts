import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import type { Specialty, Difficulty } from './specialties'
import { SPECIALTY_DOMAIN, SPECIALTY_HARD_EXAMPLES } from './specialties'

export function buildPatientPrompt(
  specialty: Specialty,
  difficulty: Difficulty,
  existingComplaints: string[] = []
): ChatCompletionCreateParamsNonStreaming {
  const domain = SPECIALTY_DOMAIN[specialty]
  const hardSection = difficulty === 'hard'
    ? `\nDIAGNÓSTICOS HARD PARA ${specialty} (CRÍTICO): em nível hard, escolha um diagnóstico que exija raciocínio diferencial amplo. Exemplos apropriados para ${specialty}: ${SPECIALTY_HARD_EXAMPLES[specialty]}. PROIBIDO usar diagnósticos comuns ou de reconhecimento imediato mesmo que pertençam à especialidade (ex: Cardiologia → NÃO use taquicardia supraventricular simples, hipertensão essencial, angina estável; Pneumologia → NÃO use asma/bronquite/pneumonia comunitária típica). Se o diagnóstico for facilmente reconhecível por um residente em segundos, NÃO serve para hard.`
    : ''
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
Domínio de apresentação dessa especialidade: ${domain}.
Nível de dificuldade: ${difficulty}.
${avoidSection}
Regras por dificuldade (a dificuldade refere-se à COMPLEXIDADE DIAGNÓSTICA, não apenas à vagueza da queixa):
- easy: diagnóstico comum e prevalente, quadro clássico de manual, raciocínio direto (ex: pneumonia comunitária típica, ITU não complicada, enxaqueca). Sem comorbidades ou no máximo 1 leve.
- medium: diagnóstico moderadamente complexo, com 1-2 diagnósticos diferenciais plausíveis a considerar; 1-2 comorbidades. Exige investigação dirigida.
- hard: diagnóstico DESAFIADOR — condição menos prevalente, atípica, sistêmica ou que exige ampla investigação e exclusão (ex: doenças autoimunes, endocrinopatias raras, neoplasias ocultas, doenças infecciosas atípicas). NÃO use diagnósticos triviais (cistite, faringite, gripe) em casos hard. Múltiplas comorbidades que confundem o quadro. ATENÇÃO: mesmo um diagnóstico sistêmico/de outra área deve ENTRAR pela manifestação de apresentação do domínio de ${specialty} (ver REGRA DE ESPECIALIDADE abaixo).
${hardSection}
REGRAS DE COMORBIDADE (conditions):
- As comorbidades devem ser PLAUSÍVEIS PARA A IDADE. NÃO atribua hipertensão e diabetes a pacientes jovens (< 40 anos) de forma automática.
- Pacientes jovens geralmente têm POUCAS ou NENHUMA comorbidade.
- Varie as comorbidades de acordo com o perfil: jovens podem ter asma, ansiedade, tireoidopatia; idosos podem ter HAS, DM, DPOC, etc.
- conditions pode ser uma lista vazia [] — não force comorbidades.

IMPORTANTE: Escolha o diagnóstico verdadeiro PRIMEIRO (respeitando a complexidade da dificuldade), depois construa o caso clínico de forma consistente com ele. O chief_complaint, clinical_status e conditions devem ser compatíveis com o true_diagnosis escolhido.

REGRAS DO true_diagnosis (CRÍTICO):
- Deve ser UMA única doença/condição REAL e reconhecida, nomeada de forma CANÔNICA (como apareceria na CID-10 ou num manual de medicina). Ex válidos: "Edema agudo de pulmão", "Tromboembolismo pulmonar", "Cetoacidose diabética", "Lúpus eritematoso sistêmico".
- NÃO invente síndromes, classificações ou nomes compostos (ex PROIBIDO: "Síndrome da Classe II da EAP", "Edema Agudo de Pulmão com Hipertensão Pulmonar"). NÃO una duas doenças num só nome nem use parênteses explicativos. Uma doença, nome fechado e simples.
- PROIBIDO diagnóstico VAGO, com HEDGE ou ALTERNATIVAS. NÃO use "possivelmente", "provável", "ou", "/", "vs", "suspeita de", "a esclarecer", nem categorias genéricas sem nomear a entidade (ex PROIBIDO: "Infecção pulmonar, possivelmente pneumonia ou tuberculose"; "infecção a esclarecer"; "doença reumatológica"). Comprometa-se com UMA doença fechada e específica — ex: escolha "Tuberculose pulmonar" OU "Lúpus eritematoso sistêmico", nunca as duas nem a categoria que as engloba.
- AUTOVERIFICAÇÃO do true_diagnosis: "É UMA doença única, fechada e específica? Contém 'possivelmente', 'ou', '/', 'suspeita', 'provável' ou é uma categoria vaga? Se sim, REESCREVA para uma única doença canônica." TODO o caso (queixa, exame físico, resultados de exames) será ancorado nesse diagnóstico — se ele for ambíguo, o caso inteiro fica incoerente (achados de uma doença com rótulo de outra).

REGRA DE ESPECIALIDADE (CRÍTICO — a QUEIXA define a especialidade, não o diagnóstico):
- A MANIFESTAÇÃO PRINCIPAL (chief_complaint) DEVE pertencer ao domínio de ${specialty}: ${domain}. É essa apresentação que faria o paciente procurar/ser encaminhado a um especialista em ${specialty}.
- O true_diagnosis PODE ser uma doença primária de ${specialty} OU uma doença sistêmica/de outra especialidade — MAS, nesse caso, o paciente DEVE estar se apresentando justamente pela manifestação dessa doença que cai no domínio de ${specialty}. Exemplo (Pneumologia): "Lúpus eritematoso sistêmico" só é aceitável se a apresentação for PULMONAR (dor torácica pleurítica, dispneia por pneumonite ou derrame pleural) — NUNCA com artralgia ou manchas na pele como queixa principal.
- AUTOVERIFICAÇÃO antes de responder: "A queixa principal é uma manifestação típica do domínio de ${specialty}, que levaria este paciente a um especialista em ${specialty}?" Se NÃO, reescolha o diagnóstico OU reescreva a apresentação para uma manifestação dessa especialidade.

REGRA DE COERÊNCIA queixa↔diagnóstico (CRÍTICO):
- O chief_complaint DEVE ser o SINTOMA DE APRESENTAÇÃO TÍPICO do true_diagnosis — o motivo real e mais provável pelo qual ESSE paciente procuraria atendimento HOJE. Ex: Edema agudo de pulmão → "falta de ar súbita e intensa que piora quando deito"; Tromboembolismo pulmonar → "falta de ar repentina e dor no peito ao respirar fundo". NUNCA escolha uma queixa periférica/secundária que não levaria o médico a suspeitar do diagnóstico.
- AUTOVERIFICAÇÃO antes de responder: "Um médico, ouvindo este chief_complaint, consideraria o true_diagnosis entre as principais hipóteses?" Se a resposta for NÃO, reescreva a queixa para refletir a apresentação típica do diagnóstico.

Responda APENAS com JSON válido, sem texto adicional:
{
  "name": "nome fictício brasileiro",
  "age": número inteiro entre 18 e 80,
  "gender": "M" ou "F",
  "chief_complaint": "queixa principal em 1 frase, na voz do paciente, = apresentação típica do diagnóstico",
  "clinical_status": "estado clínico inicial em 1 frase curta, na voz do sistema",
  "conditions": ["comorbidades preexistentes relevantes ao caso"],
  "true_diagnosis": "UMA doença real, nome canônico fechado (ex: Colite Microscópica, IAM sem supra, DPOC em exacerbação)"
}`,
    }],
  }
}
