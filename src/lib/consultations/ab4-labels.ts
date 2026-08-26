// Rótulos das dimensões dos scores em linguagem clínica clara, para o aluno.
// Substituem os nomes aristotélicos (Poético/Retórico/Dialético/Analítico),
// que confundiam. Usados no FinishModal e no ConsultationReadOnly.

export const AB4_AXES: { key: 'a1' | 'a2' | 'a3' | 'a4'; label: string }[] = [
  { key: 'a1', label: 'Hipóteses' },
  { key: 'a2', label: 'Plausibilidade' },
  { key: 'a3', label: 'Diferencial' },
  { key: 'a4', label: 'Fechamento' },
]

export const COMM_AXES: { key: 'c1' | 'c2' | 'c3'; label: string }[] = [
  { key: 'c1', label: 'Clareza' },
  { key: 'c2', label: 'Empatia' },
  { key: 'c3', label: 'Condução' },
]
