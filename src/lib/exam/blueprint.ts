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

// Áreas QUANTITATIVAS/não-beira-leito: Saúde Coletiva (epidemiologia, SUS, estatística
// de testes) e Competências Gerais (ética, gestão, MBE). Nelas a questão NÃO é uma
// vinheta clínica de paciente — é um cenário/estudo com dados para leitura crítica.
// O gerador e o validador tratam essas áreas por um caminho próprio.
const QUANTITATIVE_AREAS = new Set<string>(['preventiva', 'gerais'])
export const isQuantitativeArea = (areaKey: string): boolean => QUANTITATIVE_AREAS.has(areaKey)

// ───────── Blueprint estrutural (derivado das provas reais 2021–2026) ─────────
// Engenharia de dados sobre 600 questões (6 provas): as edições recentes
// (ENARE 2025 / ENAMED 2026) têm enunciado longo (mediana ~80–87 palavras, p90
// ~130–134), vinheta clínica em >90% e 3–4 dados numéricos. Calibramos pelo
// alvo RECENTE, não pela média histórica (que incluía provas curtas e antigas).
export type StructuralSpec = {
  stemMinWords: number   // piso de palavras do enunciado (p10 recente ≈ 32–53)
  stemTargetWords: number // alvo central (mediana recente ≈ 80–87)
  stemMaxWords: number   // teto (p90 recente ≈ 130–134)
  numDataMin: number     // dados numéricos objetivos mínimos (vitais/labs/imagem)
  optMinWords: number    // alternativa não pode ser monossilábica
  optMaxWords: number    // teto por alternativa
}

// Trilha do ENARE — como na vida real: acesso direto (R1, áreas amplas) e
// pré-requisito (R3+, subespecialidade). ENAMED é trilha única.
export type ExamTrack = 'acesso-direto' | 'pre-requisito'

export function examStructuralSpec(exam: ExamType, track: ExamTrack = 'acesso-direto'): StructuralSpec {
  if (exam === 'enamed')
    return { stemMinWords: 55, stemTargetWords: 90, stemMaxWords: 150, numDataMin: 3, optMinWords: 3, optMaxWords: 34 }
  // ENARE pré-requisito (medido em 594 questões): enunciado mediana ~119 (p90 ~204),
  // alternativas longas (mediana ~22 palavras), ~7 dados numéricos, vinheta ~90%.
  if (track === 'pre-requisito')
    return { stemMinWords: 70, stemTargetWords: 120, stemMaxWords: 215, numDataMin: 4, optMinWords: 8, optMaxWords: 55 }
  // ENARE acesso direto (R1) — edições recentes.
  return { stemMinWords: 50, stemTargetWords: 85, stemMaxWords: 140, numDataMin: 3, optMinWords: 3, optMaxWords: 38 }
}

// Subespecialidades de PRÉ-REQUISITO (R3+) com temas de alto rendimento.
export const PRE_REQ_SPECIALTIES = [
  { key: 'cardiologia', label: 'Cardiologia', topics: 'insuficiência cardíaca e miocardiopatias, síndromes coronarianas e SCA, arritmias e dispositivos, valvopatias, hipertensão pulmonar, emergências hipertensivas, dislipidemia, imagem cardíaca' },
  { key: 'nefrologia', label: 'Nefrologia', topics: 'injúria renal aguda e DRC, distúrbios hidroeletrolíticos e ácido-base, glomerulopatias, diálise e transplante, hipertensão secundária, doença renal no diabetes, nefrolitíase' },
  { key: 'pneumologia', label: 'Pneumologia', topics: 'DPOC e asma, TEP, doenças intersticiais, pneumonias e derrame pleural, câncer de pulmão, apneia do sono, ventilação e insuficiência respiratória' },
  { key: 'gastroenterologia', label: 'Gastroenterologia', topics: 'hepatopatias e cirrose, hemorragia digestiva, DII, pancreatite, doença péptica e H. pylori, doenças biliares, oncologia do TGI, disfagia' },
  { key: 'endocrinologia', label: 'Endocrinologia', topics: 'diabetes e complicações, tireoide, adrenal, osteometabolismo e cálcio, obesidade, hipófise, distúrbios do crescimento' },
  { key: 'reumatologia', label: 'Reumatologia', topics: 'artrite reumatoide, LES e SAF, vasculites, espondiloartrites, gota e artrites microcristalinas, miopatias inflamatórias, esclerose sistêmica' },
  { key: 'infectologia', label: 'Infectologia', topics: 'HIV e infecções oportunistas, tuberculose, sepse e antimicrobianos, endocardite, hepatites virais, infecções hospitalares e multirresistência, arboviroses' },
  { key: 'geriatria', label: 'Geriatria', topics: 'síndromes geriátricas (quedas, delirium, fragilidade), polifarmácia, demências, incontinência, avaliação geriátrica ampla, cuidados paliativos' },
  { key: 'cirurgia-vascular', label: 'Cirurgia Vascular', topics: 'doença arterial periférica e isquemia aguda, aneurisma de aorta, TVP e doença venosa, pé diabético, carótida, acessos vasculares' },
  { key: 'cirurgia-digestiva', label: 'Cirurgia do Aparelho Digestivo', topics: 'câncer gástrico e esofágico, doenças biliopancreáticas, cirurgia bariátrica, hérnias complexas, cirurgia colorretal, transplante hepático' },
] satisfies ReadonlyArray<{ key: string; label: string; topics: string }>

export type PreReqKey = (typeof PRE_REQ_SPECIALTIES)[number]['key']
