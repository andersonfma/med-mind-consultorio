import { describe, it, expect } from 'vitest'
import { premiumSource, aggregateByFaculty, normFaculty } from './segments'

describe('premiumSource', () => {
  it('não premium => none', () => {
    expect(premiumSource(false, false, false)).toBe('none')
    expect(premiumSource(false, true, true)).toBe('none')
  })
  it('pagamento aprovado tem precedência sobre fundador', () => {
    expect(premiumSource(true, true, true)).toBe('hotmart')
    expect(premiumSource(true, false, true)).toBe('hotmart')
  })
  it('fundador quando só há resgate de cupom', () => {
    expect(premiumSource(true, true, false)).toBe('fundador')
  })
  it('manual quando premium sem venda nem cupom (caso suspeito)', () => {
    expect(premiumSource(true, false, false)).toBe('manual')
  })
})

describe('normFaculty', () => {
  it('colapsa espaços e trata vazio como null', () => {
    expect(normFaculty('  UNIRIO ')).toBe('UNIRIO')
    expect(normFaculty('USP   RP')).toBe('USP RP')
    expect(normFaculty('   ')).toBeNull()
    expect(normFaculty(null)).toBeNull()
  })
})

describe('aggregateByFaculty', () => {
  it('separa estudantes de médicos e ordena por total desc', () => {
    const rows = aggregateByFaculty([
      { faculty: 'UNIRIO', user_type: 'student' },
      { faculty: 'UNIRIO', user_type: 'student' },
      { faculty: 'UNIRIO', user_type: 'doctor' },
      { faculty: 'USP', user_type: 'student' },
    ])
    expect(rows[0]).toEqual({ faculty: 'UNIRIO', students: 2, doctors: 1, total: 3 })
    expect(rows[1]).toEqual({ faculty: 'USP', students: 1, doctors: 0, total: 1 })
  })
  it('agrupa faltantes em "Não informado" e joga para o fim', () => {
    const rows = aggregateByFaculty([
      { faculty: null, user_type: 'student' },
      { faculty: 'USP', user_type: 'student' },
      { faculty: '', user_type: 'doctor' },
    ])
    expect(rows[rows.length - 1].faculty).toBe('Não informado')
    expect(rows.find((r) => r.faculty === 'Não informado')!.total).toBe(2)
  })
  it('tipo ausente conta como estudante (default do produto)', () => {
    const rows = aggregateByFaculty([{ faculty: 'UFF', user_type: null }])
    expect(rows[0]).toEqual({ faculty: 'UFF', students: 1, doctors: 0, total: 1 })
  })
})
