import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import type { Specialty, Difficulty } from './specialties'
import { SPECIALTY_DOMAIN, SPECIALTY_HARD_EXAMPLES } from './specialties'
import { MODELS } from '@/lib/openai/models'

export function buildPatientPrompt(
  specialty: Specialty,
  difficulty: Difficulty,
  existingComplaints: string[] = []
): ChatCompletionCreateParamsNonStreaming {
  const domain = SPECIALTY_DOMAIN[specialty]
  const hardSection = difficulty === 'hard'
    ? `\nNÍVEL HARD — DIFICULDADE = DESAFIO DE RACIOCÍNIO, NÃO APENAS RARIDADE (CRÍTICO):
Um caso hard NÃO é definido por ser uma doença rara com apresentação de manual — uma doença rara com quadro clássico é FÁCIL (viu os achados típicos → óbvio). Hard é definido por EXIGIR raciocínio diagnóstico fino. Construa o caso usando PELO MENOS UM (idealmente dois) destes mecanismos:
1) APRESENTAÇÃO ATÍPICA: a doença (comum OU rara) se manifesta de forma NÃO clássica — o sinal/sintoma que "entrega" o diagnóstico está ausente, mascarado ou substituído por outro. Ex: IAM como dor epigástrica e náusea em idoso diabético (sem dor torácica típica); TEP como síncope isolada; hipertireoidismo como fibrilação atrial isolada no idoso; apendicite retrocecal com dor atípica.
2) DISTRATOR / ARMADILHA DIAGNÓSTICA: a apresentação inicial e/ou as comorbidades apontam FORTEMENTE para um diagnóstico COMUM porém ERRADO (a "âncora"), plausível a ponto de o aluno fechar nele cedo. O verdadeiro só emerge se ele não ancorar e investigar além do óbvio. As comorbidades devem ser CONFUNDIDORES plausíveis (mascaram ou mimetizam o quadro), não decorativas.
3) COMPLEXIDADE MULTISSISTÊMICA: doença que repercute em mais de um sistema, exigindo CONECTAR achados dispersos (vasculites, sarcoidose, endocardite infecciosa com fenômenos embólicos, LES, endocrinopatias com repercussão sistêmica). Doenças com esse potencial em ${specialty}: ${SPECIALTY_HARD_EXAMPLES[specialty]}.
PERMITIDO usar uma doença COMUM em hard — SOMENTE se a apresentação for atípica/enganosa (mecanismo 1 ou 2); muitas vezes isso é MAIS difícil que uma doença rara clássica. PROIBIDO doença comum com apresentação de manual (isso é easy/medium).
A chief_complaint deve ser o PONTO DE ENTRADA que sugere a via atípica ou a armadilha — NUNCA o sintoma que entrega o diagnóstico de imediato.
MANTENHA as regras de true_diagnosis: doença única, canônica e específica — PROIBIDO diagnóstico SINDRÔMICO genérico em hard ("síndrome nefrótica", "insuficiência cardíaca", "lesão renal aguda"): nomeie a DOENÇA/ETIOLOGIA subjacente (a glomerulopatia, a cardiopatia, a causa).`
    : ''
  const avoidSection = existingComplaints.length > 0
    ? `\nIMPORTANTE — Variedade: o aluno já tem pacientes com as seguintes queixas principais:\n${existingComplaints.map(c => `- "${c}"`).join('\n')}\nGere um paciente com queixa E síndrome COMPLETAMENTE DIFERENTE das listadas acima. Evite qualquer sobreposição de sintoma principal (não usar falta de ar, cansaço, dor no peito se já existem; use cefaleias, sintomas GI, urinários, osteoarticulares, neurológicos, endócrinos, etc.).\n`
    : ''

  return {
    model: MODELS.generation,
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
- PROIBIDO diagnóstico SINDRÔMICO quando existe uma DOENÇA/ETIOLOGIA específica subjacente — nomeie a ENTIDADE NOSOLÓGICA (a CAUSA), não o agrupamento de sinais. A apresentação clínica (chief_complaint, clinical_status) PODE ser sindrômica, mas o true_diagnosis tem de ser a doença específica. Ex PROIBIDO → use a causa: "síndrome nefrótica" → nomear a glomerulopatia (Doença de lesões mínimas, Glomeruloesclerose segmentar e focal, Nefropatia membranosa, Glomerulonefrite membranoproliferativa, Amiloidose renal); "síndrome nefrítica" → a glomerulonefrite específica; "insuficiência cardíaca" → a cardiopatia de base; "insuficiência renal aguda" / "lesão renal aguda" → a etiologia; "AVC" → tipo e território; "abdome agudo" → a doença. Isto é especialmente OBRIGATÓRIO em casos medium/hard: um diagnóstico sindrômico genérico trivializa um caso que deveria ser complexo.
- AUTOVERIFICAÇÃO do true_diagnosis: "É UMA doença única, fechada e específica? Contém 'possivelmente', 'ou', '/', 'suspeita', 'provável' ou é uma categoria vaga? É uma SÍNDROME que na verdade tem uma doença/causa subjacente nomeável? Se sim, REESCREVA para a doença canônica específica (a etiologia)." TODO o caso (queixa, exame físico, resultados de exames) será ancorado nesse diagnóstico — se ele for ambíguo ou sindrômico, o caso inteiro fica incoerente ou trivial.

REGRA DE ESPECIALIDADE (CRÍTICO — a QUEIXA define a especialidade, não o diagnóstico):
- A MANIFESTAÇÃO PRINCIPAL (chief_complaint) DEVE pertencer ao domínio de ${specialty}: ${domain}. É essa apresentação que faria o paciente procurar/ser encaminhado a um especialista em ${specialty}.
- O true_diagnosis PODE ser uma doença primária de ${specialty} OU uma doença sistêmica/de outra especialidade — MAS, nesse caso, o paciente DEVE estar se apresentando justamente pela manifestação dessa doença que cai no domínio de ${specialty}. Exemplo (Pneumologia): "Lúpus eritematoso sistêmico" só é aceitável se a apresentação for PULMONAR (dor torácica pleurítica, dispneia por pneumonite ou derrame pleural) — NUNCA com artralgia ou manchas na pele como queixa principal.
- AUTOVERIFICAÇÃO antes de responder: "A queixa principal é uma manifestação típica do domínio de ${specialty}, que levaria este paciente a um especialista em ${specialty}?" Se NÃO, reescolha o diagnóstico OU reescreva a apresentação para uma manifestação dessa especialidade.

REGRA DE COERÊNCIA queixa↔diagnóstico (CRÍTICO):
- O chief_complaint DEVE ser o SINTOMA DE APRESENTAÇÃO TÍPICO do true_diagnosis — o motivo real e mais provável pelo qual ESSE paciente procuraria atendimento HOJE. Ex: Edema agudo de pulmão → "falta de ar súbita e intensa que piora quando deito"; Tromboembolismo pulmonar → "falta de ar repentina e dor no peito ao respirar fundo". NUNCA escolha uma queixa periférica/secundária que não levaria o médico a suspeitar do diagnóstico.
- UM ÚNICO SINTOMA (CRÍTICO): o chief_complaint é APENAS o sintoma principal que motivou a vinda — NÃO uma síndrome nem uma lista. PROIBIDO empilhar sintomas associados (febre + sudorese noturna + emagrecimento + caroços) na queixa. Esses achados associados pertencem ao quadro clínico e serão DESCOBERTOS pelo aluno na anamnese — não podem estar na queixa. Ex PROIBIDO: "febre há um mês, suor noturno e caroços no pescoço"; CERTO: "uns caroços no pescoço que não somem" OU "uma febre que não passa". Escolha o sintoma mais proeminente e pare nele.
- AUTOVERIFICAÇÃO antes de responder: "Um médico, ouvindo este chief_complaint, consideraria o true_diagnosis entre as principais hipóteses? É UM único sintoma (não uma lista de vários)?" Se a resposta a qualquer uma for NÃO, reescreva a queixa.

Responda APENAS com JSON válido, sem texto adicional:
{
  "name": "nome fictício brasileiro",
  "age": número inteiro entre 18 e 80,
  "gender": "M" ou "F",
  "chief_complaint": "UM único sintoma principal em 1 frase curta, na voz do paciente (sem listar sintomas associados)",
  "clinical_status": "estado clínico inicial em 1 frase curta, na voz do sistema",
  "conditions": ["comorbidades preexistentes relevantes ao caso"],
  "true_diagnosis": "UMA doença real, nome canônico fechado (ex: Colite Microscópica, IAM sem supra, DPOC em exacerbação)"
}`,
    }],
  }
}
