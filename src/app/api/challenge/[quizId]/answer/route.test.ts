// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockFrom, mockBalance } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockFrom: vi.fn(), mockBalance: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn().mockReturnValue({ from: mockFrom }) }))
vi.mock('@/lib/challenge/today', () => ({ getMedcoinBalance: mockBalance }))
import { NextRequest } from 'next/server'
import { POST } from './route'

const TODAY = new Date().toISOString().slice(0, 10)
const ctx = (id: string) => ({ params: Promise.resolve({ quizId: id }) })
const req = (b: unknown) => new NextRequest('http://localhost/api/challenge/q1/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })

function wire({ reveal = TODAY, answered = false, correct = 'A' } = {}) {
  mockFrom.mockImplementation((t: string) => {
    if (t === 'challenge_days') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { reveal_date: reveal, stage: 'anamnese' } }) }) }) }
    if (t === 'quizzes') return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { correct_key: correct, explanation: 'e' } }) }) }) }
    if (t === 'profiles') return {
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { challenge_streak: 1, challenge_last_date: null } }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }
    if (t === 'medcoin_events') return { insert: () => Promise.resolve({ error: null }) }
    if (t === 'quiz_answers') {
      return {
        // prev check: select().eq().eq().maybeSingle(); pct: select().eq() (thenable)
        select: () => {
          const chain: Record<string, unknown> = {}
          chain.eq = () => chain
          chain.maybeSingle = () => Promise.resolve({ data: answered ? { user_id: 'u1' } : null })
          chain.then = (res: (v: unknown) => void) => res({ data: [{ is_correct: true }] })
          return chain
        },
        // insert falha com 23505 quando `answered` (simula corrida/TOCTOU)
        insert: () => Promise.resolve({ error: answered ? { code: '23505' } : null }),
      }
    }
    return {}
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockBalance.mockResolvedValue(100)
  wire()
})

describe('POST challenge answer', () => {
  it('401 sem usuário', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await POST(req({ chosenKey: 'A', stake: 10 }), ctx('q1'))).status).toBe(401)
  })
  it('403 dia não é hoje (fechado/futuro)', async () => {
    wire({ reveal: '2000-01-01' })
    expect((await POST(req({ chosenKey: 'A', stake: 10 }), ctx('q1'))).status).toBe(403)
  })
  it('409 já respondeu', async () => {
    wire({ answered: true })
    expect((await POST(req({ chosenKey: 'A', stake: 10 }), ctx('q1'))).status).toBe(409)
  })
  it('200 acerto → gabarito + delta>0', async () => {
    const res = await POST(req({ chosenKey: 'A', stake: 10 }), ctx('q1'))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.isCorrect).toBe(true); expect(j.correctKey).toBe('A'); expect(j.delta).toBeGreaterThan(0)
  })
  it('409 em corrida: prev-check passa mas insert viola unicidade (TOCTOU)', async () => {
    // prev SELECT sem resposta, mas insert retorna 23505 (outro request gravou antes)
    mockFrom.mockImplementation((t: string) => {
      if (t === 'challenge_days') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { reveal_date: TODAY, stage: 'anamnese' } }) }) }) }
      if (t === 'quizzes') return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { correct_key: 'A', explanation: 'e' } }) }) }) }
      if (t === 'profiles') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { challenge_streak: 1, challenge_last_date: null } }) }) }), update: () => ({ eq: () => Promise.resolve({ error: null }) }) }
      if (t === 'medcoin_events') return { insert: () => Promise.resolve({ error: null }) }
      if (t === 'quiz_answers') return {
        select: () => { const c: Record<string, unknown> = {}; c.eq = () => c; c.maybeSingle = () => Promise.resolve({ data: null }); c.then = (r: (v: unknown) => void) => r({ data: [] }); return c },
        insert: () => Promise.resolve({ error: { code: '23505' } }),
      }
      return {}
    })
    expect((await POST(req({ chosenKey: 'A', stake: 10 }), ctx('q1'))).status).toBe(409)
  })
  it('200 erro → delta<=0', async () => {
    const res = await POST(req({ chosenKey: 'B', stake: 10 }), ctx('q1'))
    const j = await res.json(); expect(j.isCorrect).toBe(false); expect(j.delta).toBeLessThanOrEqual(0)
  })
})
