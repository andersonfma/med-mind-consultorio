// Modelagem ENARE/ENAMED — ver docs/.../2026-10-30-modelagem-simulados.md
// Questões ORIGINAIS geradas por IA nos moldes das provas (nunca cópia de prova real).

export type ExamType = 'enare' | 'enamed'

export const EXAM_TYPES = [
  { key: 'enare' as const, label: 'ENARE', options: 5, note: 'Residência médica — 5 alternativas (A–E).' },
  { key: 'enamed' as const, label: 'ENAMED', options: 4, note: 'Avaliação da formação (INEP) — 4 alternativas (A–D).' },
] satisfies ReadonlyArray<{ key: ExamType; label: string; options: number; note: string }>

export const examOptions = (exam: ExamType): number => (exam === 'enamed' ? 4 : 5)

// Áreas. `weight` = incidência aprox. no ENARE (para a prova completa futura; no simulado por área
// não importa). `topics` = temas de alto rendimento ORDENADOS por incidência (os primeiros pesam mais).
export const EXAM_AREAS = [
  {
    key: 'clinica', label: 'Clínica Médica', weight: 25,
    topics: 'arritmias e insuficiência cardíaca, síndromes coronarianas, hipertensão e emergências hipertensivas, diabetes e tireoide, distúrbios hidroeletrolíticos e ácido-base, injúria renal e DRC, pneumonia/DPOC/asma/TEP, hepatopatias e hemorragia digestiva, sepse/HIV/tuberculose/endocardite, cefaleias e AVC, vasculites e doenças autoimunes, emergências e terapia intensiva',
  },
  {
    key: 'cirurgia', label: 'Cirurgia Geral', weight: 21,
    topics: 'trauma (ATLS, choque hemorrágico, trauma abdominal/torácico), abdome agudo (apendicite, colecistite, obstrução, perfuração, pancreatite), cirurgia do aparelho digestivo e oncologia do TGI, pós-operatório e complicações, hérnias de parede, princípios de urologia e cirurgia vascular, queimados',
  },
  {
    key: 'go', label: 'Ginecologia e Obstetrícia', weight: 19,
    topics: 'doenças clínicas na gestação (síndromes hipertensivas, diabetes gestacional), infecções genitais e DST, hemorragias da 1ª e 2ª metades da gestação, trabalho de parto e puerpério, oncologia ginecológica (colo, mama, endométrio), ginecologia endócrina e amenorreias, uroginecologia, planejamento familiar, rastreios',
  },
  {
    key: 'preventiva', label: 'Medicina Preventiva e Saúde Coletiva', weight: 19,
    topics: 'SUS (princípios, redes de atenção, financiamento, pactos), epidemiologia (tipos de estudo, medidas de associação, incidência/prevalência), testes diagnósticos (sensibilidade, especificidade, VPP/VPN, likelihood ratio), vigilância epidemiológica e doenças de notificação, atenção primária e MFC, indicadores de saúde, saúde do trabalhador',
  },
  {
    key: 'pediatria', label: 'Pediatria', weight: 15,
    topics: 'vacinação e calendário, puericultura e crescimento/desenvolvimento, infecções de vias aéreas e pneumonias, diarreia aguda e desidratação, neonatologia (icterícia, sepse neonatal, prematuridade, reanimação), doenças exantemáticas, cardiopatias congênitas, oncohematologia pediátrica, aleitamento materno',
  },
  {
    key: 'gerais', label: 'Competências Gerais', weight: 20,
    topics: 'ética e deontologia médica (Código de Ética Médica, sigilo, consentimento, autonomia), bioética e conflitos (terminalidade, objeção de consciência), relação médico-paciente e comunicação de más notícias, segurança do paciente e qualidade, medicina baseada em evidências e leitura crítica, gestão e organização do SUS, prontuário e documentos médicos (atestado, declaração de óbito), responsabilidade profissional e notificação compulsória',
  },
] satisfies ReadonlyArray<{ key: string; label: string; weight: number; topics: string }>

export type ExamAreaKey = (typeof EXAM_AREAS)[number]['key']
export const EXAM_QUESTIONS_PER_SIM = 10
