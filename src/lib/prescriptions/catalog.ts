import type { Specialty } from '@/lib/patients/specialties'

export interface CatalogDrug {
  name: string
  posology: string
  indication: string
}

/**
 * Catálogo curado de princípios ativos comuns por especialidade, com posologia
 * padrão (editável pelo aluno) e indicação. Curadoria pedagógica — nomes reais,
 * conferíveis contra os Dados Abertos da ANVISA. NÃO é exaustivo: o aluno pode
 * prescrever fora do catálogo via texto livre (validado por IA).
 * Evolução futura: importar DADOS_ABERTOS_MEDICAMENTOS.csv da ANVISA.
 */
export const PRESCRIPTION_CATALOG: Record<Specialty, CatalogDrug[]> = {
  'Clínica Médica': [
    { name: 'Dipirona', posology: '500–1000 mg VO até 6/6h se dor ou febre', indication: 'Analgésico/antitérmico' },
    { name: 'Paracetamol', posology: '500–750 mg VO até 6/6h, máx 4 g/dia', indication: 'Analgésico/antitérmico' },
    { name: 'Omeprazol', posology: '20–40 mg VO 1x/dia em jejum', indication: 'Proteção gástrica / DRGE' },
    { name: 'Amoxicilina', posology: '500 mg VO 8/8h por 7 dias', indication: 'Antibiótico de amplo espectro' },
    { name: 'Prednisona', posology: '20–40 mg VO 1x/dia pela manhã, com desmame', indication: 'Corticoide sistêmico' },
    { name: 'Sintomáticos para IVAS', posology: 'Hidratação, repouso, antitérmico se febre', indication: 'Suporte em virose' },
  ],
  'Cardiologia': [
    { name: 'Losartana', posology: '50 mg VO 1x/dia (até 100 mg/dia)', indication: 'Anti-hipertensivo (BRA)' },
    { name: 'Enalapril', posology: '10 mg VO 12/12h', indication: 'Anti-hipertensivo (IECA)' },
    { name: 'Anlodipino', posology: '5 mg VO 1x/dia (até 10 mg)', indication: 'Anti-hipertensivo (BCC)' },
    { name: 'Hidroclorotiazida', posology: '25 mg VO 1x/dia pela manhã', indication: 'Diurético tiazídico' },
    { name: 'Atenolol', posology: '25–50 mg VO 1x/dia', indication: 'Betabloqueador' },
    { name: 'AAS', posology: '100 mg VO 1x/dia após almoço', indication: 'Antiagregante plaquetário' },
    { name: 'Atorvastatina', posology: '20–40 mg VO 1x/dia à noite', indication: 'Hipolipemiante (estatina)' },
    { name: 'Furosemida', posology: '40 mg VO 1x/dia pela manhã', indication: 'Diurético de alça' },
  ],
  'Gastroenterologia': [
    { name: 'Omeprazol', posology: '40 mg VO 1x/dia em jejum por 4–8 semanas', indication: 'IBP — DRGE/úlcera' },
    { name: 'Domperidona', posology: '10 mg VO 3x/dia antes das refeições', indication: 'Procinético' },
    { name: 'Hioscina (Buscopan)', posology: '10 mg VO até 8/8h se cólica', indication: 'Antiespasmódico' },
    { name: 'Loperamida', posology: '4 mg VO inicial, 2 mg após cada evacuação líquida', indication: 'Antidiarreico' },
    { name: 'Mesalazina', posology: '800 mg VO 8/8h', indication: 'Doença inflamatória intestinal' },
    { name: 'Lactulose', posology: '15–30 mL VO 1–2x/dia', indication: 'Laxativo osmótico' },
  ],
  'Pneumologia': [
    { name: 'Salbutamol', posology: '2 jatos inalatórios até 6/6h se dispneia', indication: 'Broncodilatador β2 de curta ação' },
    { name: 'Budesonida/Formoterol', posology: '1 inalação 12/12h', indication: 'Corticoide inalatório + LABA' },
    { name: 'Prednisona', posology: '40 mg VO 1x/dia por 5 dias', indication: 'Exacerbação de asma/DPOC' },
    { name: 'Brometo de ipratrópio', posology: '2 jatos inalatórios 6/6h', indication: 'Anticolinérgico inalatório' },
    { name: 'Amoxicilina/Clavulanato', posology: '875/125 mg VO 12/12h por 7 dias', indication: 'PAC / exacerbação infecciosa' },
    { name: 'Azitromicina', posology: '500 mg VO 1x/dia por 3–5 dias', indication: 'Antibiótico (atípicos)' },
  ],
  'Endocrinologia': [
    { name: 'Metformina', posology: '500–850 mg VO 12/12h com refeições', indication: 'DM2 — primeira linha' },
    { name: 'Insulina NPH', posology: 'Dose individualizada SC, geralmente 0,2 U/kg/dia', indication: 'DM — controle basal' },
    { name: 'Levotiroxina', posology: '50–100 mcg VO 1x/dia em jejum', indication: 'Hipotireoidismo' },
    { name: 'Glibenclamida', posology: '5 mg VO 1x/dia antes do café', indication: 'DM2 — sulfonilureia' },
    { name: 'Dapagliflozina', posology: '10 mg VO 1x/dia', indication: 'DM2 (iSGLT2)' },
    { name: 'Sinvastatina', posology: '20–40 mg VO 1x/dia à noite', indication: 'Dislipidemia' },
  ],
  'Nefrologia': [
    { name: 'Losartana', posology: '50 mg VO 1x/dia', indication: 'Nefroproteção / anti-HAS (BRA)' },
    { name: 'Furosemida', posology: '40 mg VO 1x/dia (ajustar à volemia)', indication: 'Diurético de alça' },
    { name: 'Carbonato de cálcio', posology: '500 mg VO às refeições', indication: 'Quelante de fósforo' },
    { name: 'Eritropoetina', posology: '50–100 U/kg SC 3x/semana', indication: 'Anemia da DRC' },
    { name: 'Bicarbonato de sódio', posology: '500 mg–1 g VO 8/8h', indication: 'Acidose metabólica da DRC' },
    { name: 'Prednisona', posology: '1 mg/kg/dia VO com desmame', indication: 'Glomerulopatia (imunossupressão)' },
  ],
  'Neurologia': [
    { name: 'Dipirona', posology: '1 g VO/IV até 6/6h se cefaleia', indication: 'Analgesia' },
    { name: 'Sumatriptano', posology: '50 mg VO no início da crise', indication: 'Crise de enxaqueca' },
    { name: 'Amitriptilina', posology: '25 mg VO à noite', indication: 'Profilaxia de enxaqueca / dor neuropática' },
    { name: 'Carbamazepina', posology: '200 mg VO 12/12h', indication: 'Epilepsia / neuralgia do trigêmeo' },
    { name: 'Levetiracetam', posology: '500 mg VO 12/12h', indication: 'Antiepiléptico' },
    { name: 'AAS', posology: '100 mg VO 1x/dia', indication: 'Prevenção secundária de AVC isquêmico' },
  ],
  'Infectologia': [
    { name: 'Amoxicilina', posology: '500 mg VO 8/8h por 7 dias', indication: 'Antibiótico de amplo espectro' },
    { name: 'Ceftriaxona', posology: '1 g IV/IM 12/12h', indication: 'Cefalosporina de 3ª geração' },
    { name: 'Azitromicina', posology: '500 mg VO 1x/dia por 3–5 dias', indication: 'Atípicos / DST' },
    { name: 'Ciprofloxacino', posology: '500 mg VO 12/12h por 7 dias', indication: 'Quinolona (Gram-negativos)' },
    { name: 'Oseltamivir', posology: '75 mg VO 12/12h por 5 dias', indication: 'Influenza' },
    { name: 'Tenofovir/Lamivudina/Dolutegravir', posology: '1 comp VO 1x/dia', indication: 'TARV (HIV)' },
  ],
}

export function searchCatalog(specialty: Specialty, query: string): CatalogDrug[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return (PRESCRIPTION_CATALOG[specialty] ?? []).filter(
    d => d.name.toLowerCase().includes(q) || d.indication.toLowerCase().includes(q)
  ).slice(0, 6)
}
