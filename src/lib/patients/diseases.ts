import type { Specialty } from './specialties'

/**
 * Sugestões de doenças por especialidade para o modo "treinar por doença".
 * NÃO é exaustivo — o aluno pode digitar uma doença fora da lista (texto livre).
 * Mistura condições comuns (bread-and-butter) e importantes/can't-miss.
 */
export const DISEASES_BY_SPECIALTY: Record<Specialty, string[]> = {
  'Clínica Médica': [
    'Pneumonia adquirida na comunidade', 'Infecção do trato urinário', 'Diabetes mellitus tipo 2',
    'Hipertensão arterial sistêmica', 'Hipotireoidismo', 'Anemia ferropriva', 'Dengue',
    'Lúpus eritematoso sistêmico', 'Artrite reumatoide', 'Sepse', 'Tromboembolismo pulmonar',
    'Sarcoidose', 'Hipertireoidismo (Doença de Graves)', 'Febre de origem indeterminada',
  ],
  'Cardiologia': [
    'Infarto agudo do miocárdio', 'Insuficiência cardíaca', 'Fibrilação atrial',
    'Angina estável', 'Pericardite aguda', 'Endocardite infecciosa', 'Miocardite',
    'Estenose aórtica', 'Cardiomiopatia hipertrófica', 'Dissecção aguda de aorta',
    'Taquicardia supraventricular', 'Amiloidose cardíaca', 'Hipertensão arterial pulmonar',
  ],
  'Gastroenterologia': [
    'Doença do refluxo gastroesofágico', 'Úlcera péptica', 'Pancreatite aguda',
    'Doença de Crohn', 'Retocolite ulcerativa', 'Colelitíase / Colecistite',
    'Hepatite viral aguda', 'Síndrome do intestino irritável', 'Doença celíaca',
    'Hemorragia digestiva alta', 'Câncer colorretal', 'Colangite esclerosante primária',
  ],
  'Pneumologia': [
    'Asma', 'DPOC (exacerbação)', 'Pneumonia', 'Tromboembolismo pulmonar',
    'Tuberculose pulmonar', 'Derrame pleural', 'Fibrose pulmonar idiopática',
    'Câncer de pulmão', 'Pneumotórax espontâneo', 'Sarcoidose',
    'Pneumonite de hipersensibilidade', 'Apneia obstrutiva do sono',
  ],
  'Endocrinologia': [
    'Diabetes mellitus tipo 1', 'Diabetes mellitus tipo 2', 'Cetoacidose diabética',
    'Hipotireoidismo', 'Hipertireoidismo (Doença de Graves)', 'Nódulo de tireoide',
    'Síndrome de Cushing', 'Insuficiência adrenal (Doença de Addison)', 'Feocromocitoma',
    'Hiperparatireoidismo primário', 'Acromegalia', 'Prolactinoma',
  ],
  'Nefrologia': [
    'Lesão renal aguda', 'Doença renal crônica', 'Síndrome nefrótica', 'Síndrome nefrítica',
    'Glomerulonefrite por IgA', 'Nefrite lúpica', 'Nefropatia diabética',
    'Infecção do trato urinário / Pielonefrite', 'Nefrolitíase', 'Distúrbios hidroeletrolíticos',
    'Glomerulonefrite rapidamente progressiva', 'Rim policístico',
  ],
  'Neurologia': [
    'AVC isquêmico', 'AVC hemorrágico', 'Enxaqueca', 'Epilepsia',
    'Esclerose múltipla', 'Doença de Parkinson', 'Miastenia gravis',
    'Síndrome de Guillain-Barré', 'Meningite bacteriana', 'Cefaleia tensional',
    'Demência de Alzheimer', 'Neuropatia periférica diabética',
  ],
  'Infectologia': [
    'HIV / AIDS', 'Tuberculose', 'Dengue', 'Sífilis', 'Endocardite infecciosa',
    'Sepse', 'Malária', 'Leptospirose', 'Hepatite B', 'Hepatite C',
    'Infecções oportunistas', 'Febre tifoide', 'Leishmaniose visceral',
  ],
  'Hepatologia': [
    'Cirrose hepática', 'Hepatite autoimune', 'Doença hepática gordurosa não alcoólica (DHGNA)',
    'Hepatite alcoólica', 'Colangite biliar primária', 'Colangite esclerosante primária',
    'Hemocromatose hereditária', 'Doença de Wilson', 'Carcinoma hepatocelular',
    'Peritonite bacteriana espontânea', 'Encefalopatia hepática', 'Síndrome de Budd-Chiari',
  ],
}

export function diseaseSuggestions(specialty: Specialty, query: string): string[] {
  const list = DISEASES_BY_SPECIALTY[specialty] ?? []
  const q = query.trim().toLowerCase()
  if (!q) return list.slice(0, 8)
  return list.filter(d => d.toLowerCase().includes(q) && d.toLowerCase() !== q).slice(0, 8)
}
