import { describe, it, expect } from 'vitest'
import { computeLeaderboard, weekStartISO, type ConsultRow, type ProfileRow } from './leaderboard'

const prof = (id: string, optin: boolean, alias?: string, full?: string): ProfileRow => ({
  id,
  leaderboard_optin: optin,
  leaderboard_alias: alias ?? null,
  full_name: full ?? null,
})

describe('computeLeaderboard', () => {
  it('agrega XP e casos por usuário e ordena por XP desc', () => {
    const consults: ConsultRow[] = [
      { user_id: 'a', points: 10 },
      { user_id: 'a', points: 15 },
      { user_id: 'b', points: 30 },
    ]
    const lb = computeLeaderboard(consults, [prof('a', true, 'Ana'), prof('b', true, 'Bia')], 'x')
    expect(lb.top.map(r => r.name)).toEqual(['Bia', 'Ana'])
    expect(lb.top[0]).toMatchObject({ rank: 1, xp: 30, cases: 1 })
    expect(lb.top[1]).toMatchObject({ rank: 2, xp: 25, cases: 2 })
  })

  it('respeita opt-in: sem opt-in aparece como Anônimo', () => {
    const lb = computeLeaderboard([{ user_id: 'a', points: 10 }], [prof('a', false, 'Ana')], 'x')
    expect(lb.top[0].name).toBe('Anônimo')
  })

  it('usa full_name quando opt-in sem apelido', () => {
    const lb = computeLeaderboard([{ user_id: 'a', points: 10 }], [prof('a', true, undefined, 'Ana Silva')], 'x')
    expect(lb.top[0].name).toBe('Ana Silva')
  })

  it('o usuário atual aparece como "Você" e é destacado', () => {
    const lb = computeLeaderboard([{ user_id: 'me', points: 10 }], [prof('me', false)], 'me')
    expect(lb.top[0]).toMatchObject({ name: 'Você', isMe: true })
    expect(lb.me).toMatchObject({ rank: 1, name: 'Você', isMe: true })
  })

  it('ignora consultas sem pontos (0 ou negativo)', () => {
    const lb = computeLeaderboard([{ user_id: 'a', points: 0 }, { user_id: 'a', points: null }], [prof('a', true, 'Ana')], 'x')
    expect(lb.top).toHaveLength(0)
  })

  it('me fica null quando o usuário não pontuou', () => {
    const lb = computeLeaderboard([{ user_id: 'a', points: 10 }], [prof('a', true, 'Ana')], 'me')
    expect(lb.me).toBeNull()
  })

  it('me reflete a posição mesmo fora do top N', () => {
    const consults: ConsultRow[] = [
      { user_id: 'a', points: 30 },
      { user_id: 'b', points: 20 },
      { user_id: 'me', points: 10 },
    ]
    const lb = computeLeaderboard(consults, [prof('a', true, 'A'), prof('b', true, 'B'), prof('me', true, 'Eu')], 'me', 2)
    expect(lb.top).toHaveLength(2)
    expect(lb.top.some(r => r.isMe)).toBe(false)
    expect(lb.me).toMatchObject({ rank: 3, xp: 10, isMe: true })
  })

  it('desempata por nº de casos', () => {
    const consults: ConsultRow[] = [
      { user_id: 'a', points: 20 },
      { user_id: 'b', points: 10 },
      { user_id: 'b', points: 10 },
    ]
    const lb = computeLeaderboard(consults, [prof('a', true, 'A'), prof('b', true, 'B')], 'x')
    expect(lb.top[0].name).toBe('B') // mesmo XP (20), mais casos (2) vem primeiro
  })
})

describe('weekStartISO', () => {
  it('retorna segunda-feira 00:00 UTC da semana', () => {
    // 2026-10-07 é uma quarta-feira → semana começa seg 2026-10-05
    expect(weekStartISO(new Date('2026-10-07T13:00:00Z'))).toBe('2026-10-05T00:00:00.000Z')
  })

  it('domingo pertence à semana que começou na segunda anterior', () => {
    // 2026-10-11 é domingo → seg 2026-10-05
    expect(weekStartISO(new Date('2026-10-11T23:00:00Z'))).toBe('2026-10-05T00:00:00.000Z')
  })

  it('segunda-feira retorna o próprio dia', () => {
    expect(weekStartISO(new Date('2026-10-05T08:00:00Z'))).toBe('2026-10-05T00:00:00.000Z')
  })
})
