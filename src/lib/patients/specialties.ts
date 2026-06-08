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

/**
 * Exemplos de diagnósticos DIFÍCEIS por especialidade (in-domain, mas que exigem
 * raciocínio diferencial amplo). Usado SÓ em dificuldade 'hard' para impedir que
 * o modelo caia em diagnósticos comuns/de reconhecimento imediato da própria área
 * (ex: Cardiologia hard NÃO deve ser taquicardia supraventricular simples).
 */
export const SPECIALTY_HARD_EXAMPLES: Record<Specialty, string> = {
  'Clínica Médica':    'febre de origem indeterminada, vasculites sistêmicas, sarcoidose, doenças autoimunes multissistêmicas, síndromes paraneoplásicas, amiloidose',
  'Cardiologia':       'cardiomiopatia hipertrófica ou restritiva, amiloidose cardíaca, pericardite constritiva, miocardite, endocardite infecciosa, hipertensão arterial pulmonar, displasia arritmogênica do ventrículo direito',
  'Gastroenterologia': 'doença de Crohn, colangite esclerosante primária, hepatite autoimune, pancreatite autoimune, isquemia mesentérica crônica, doença celíaca atípica',
  'Pneumologia':       'fibrose pulmonar idiopática, sarcoidose, hipertensão pulmonar, pneumonite de hipersensibilidade, tromboembolismo pulmonar, granulomatose com poliangeíte, linfangioleiomiomatose',
  'Endocrinologia':    'feocromocitoma, síndrome de Cushing, insuficiência adrenal, acromegalia, hiperparatireoidismo primário, insulinoma',
  'Nefrologia':        'glomerulonefrite rapidamente progressiva, nefrite lúpica, nefropatia por IgA, microangiopatia trombótica, vasculite renal, amiloidose renal',
  'Neurologia':        'esclerose múltipla, miastenia gravis, encefalite autoimune, esclerose lateral amiotrófica, síndromes paraneoplásicas, vasculite de sistema nervoso central',
  'Infectologia':      'endocardite infecciosa, tuberculose extrapulmonar, infecções oportunistas, leishmaniose visceral, infecções fúngicas sistêmicas, febre de origem indeterminada de causa infecciosa',
}
