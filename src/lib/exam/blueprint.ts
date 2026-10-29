// Blueprint das grandes áreas do ENARE/ENAMED (residência). Temas de alto rendimento
// ancoram a geração por IA — questões ORIGINAIS nos moldes, nunca cópia de prova real.
// Pesos/temas são um ponto de partida; calibrar com as edições recentes depois.
export const EXAM_AREAS = [
  { key: 'clinica', label: 'Clínica Médica',
    topics: 'cardiologia (SCA, IC, arritmias, HAS), pneumologia (DPOC, asma, TEP, pneumonia), endocrinologia (DM, tireoide, adrenal), nefrologia (IRA/DRC, distúrbios hidroeletrolíticos), gastroenterologia e hepatologia, infectologia (sepse, HIV, tuberculose, endocardite), hematologia, reumatologia, emergências clínicas' },
  { key: 'cirurgia', label: 'Cirurgia Geral',
    topics: 'abdome agudo (apendicite, colecistite, obstrução, perfuração), trauma (ATLS, choque hemorrágico), pós-operatório e complicações, oncologia cirúrgica do TGI, hérnias de parede, princípios de cirurgia vascular e endócrina' },
  { key: 'pediatria', label: 'Pediatria',
    topics: 'puericultura e crescimento/desenvolvimento, calendário vacinal, doenças exantemáticas, infecções respiratórias e diarreia aguda/desidratação, neonatologia (icterícia, sepse neonatal, prematuridade), emergências pediátricas, aleitamento' },
  { key: 'go', label: 'Ginecologia e Obstetrícia',
    topics: 'pré-natal e rastreios, síndromes hipertensivas e diabetes gestacional, hemorragias da gestação, trabalho de parto e puerpério, ciclo menstrual e sangramentos, infecções genitais e DST, rastreio e câncer de colo/mama, planejamento familiar' },
  { key: 'preventiva', label: 'Medicina Preventiva e Saúde Coletiva',
    topics: 'SUS (princípios, financiamento, redes), epidemiologia e bioestatística (tipos de estudo, medidas, testes diagnósticos), vigilância epidemiológica e doenças de notificação, atenção primária e MFC, ética e deontologia médica, indicadores de saúde' },
] as const

export type ExamAreaKey = (typeof EXAM_AREAS)[number]['key']
export const EXAM_QUESTIONS_PER_SIM = 10
