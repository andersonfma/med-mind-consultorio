export const SPECIALTIES = [
  'Clínica Médica',
  'Cardiologia',
  'Gastroenterologia',
  'Pneumologia',
  'Endocrinologia',
  'Nefrologia',
  'Neurologia',
  'Infectologia',
] as const

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

export type Specialty  = typeof SPECIALTIES[number]
export type Difficulty = typeof DIFFICULTIES[number]

/**
 * Domínio de APRESENTAÇÃO de cada especialidade — os tipos de queixa principal
 * que fariam um paciente procurar/ser encaminhado a esse especialista.
 * Usado para ancorar o chief_complaint na especialidade escolhida, mesmo quando
 * o diagnóstico verdadeiro é de outra área (ver buildPatientPrompt).
 */
export const SPECIALTY_DOMAIN: Record<Specialty, string> = {
  'Clínica Médica':    'apresentações clínicas gerais e multissistêmicas (febre de origem indeterminada, perda de peso involuntária, astenia/fadiga, queixas sistêmicas inespecíficas que exigem ampla investigação)',
  'Cardiologia':       'sintomas cardiovasculares (dor torácica, dispneia aos esforços, palpitações, síncope ou pré-síncope, edema de membros inferiores)',
  'Gastroenterologia': 'sintomas do trato digestivo (dor abdominal, diarreia ou constipação, disfagia, náusea/vômitos, icterícia, sangramento digestivo, distensão abdominal)',
  'Pneumologia':       'sintomas respiratórios (dispneia, tosse aguda ou crônica, hemoptise, dor torácica pleurítica, sibilância/chiado, expectoração)',
  'Endocrinologia':    'sintomas endócrino-metabólicos (alteração de peso, poliúria/polidipsia, intolerância ao calor/frio, alterações menstruais, sintomas de hipo/hiperglicemia, fadiga metabólica)',
  'Nefrologia':        'sintomas renais e urinários (edema, urina espumosa/proteinúria, hematúria, oligúria, hipertensão de difícil controle, sintomas urêmicos)',
  'Neurologia':        'sintomas neurológicos (cefaleia, déficit motor ou sensitivo, convulsões, alteração de consciência ou memória, vertigem, distúrbio de marcha, tremor)',
  'Infectologia':      'síndromes infecciosas (febre, sinais de infecção localizada ou sistêmica, quadros febris prolongados, sintomas associados a exposições/viagens)',
}
