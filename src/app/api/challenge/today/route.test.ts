// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockToday } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockToday: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn().mockReturnValue({}) }))
vi.mock('@/lib/challenge/today', () => ({ getChallengeToday: mockToday }))
import { GET } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockToday.mockResolvedValue({ case: null, days: [], todayDayIndex: null, conclusion: null, balance: 0, streak: 0 })
})

describe('GET /api/challenge/today', () => {
  it('401 sem usuário', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await GET()).status).toBe(401)
  })
  it('200 devolve o payload do desafio', async () => {
    const res = await GET(); expect(res.status).toBe(200)
    const j = await res.json(); expect(j).toHaveProperty('days'); expect(j.case).toBeNull()
  })
})
