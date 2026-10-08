// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockInsert, mockAdminFrom, mockRewardInsert } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockInsert: vi.fn(), mockAdminFrom: vi.fn(), mockRewardInsert: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: vi.fn().mockReturnValue({ insert: mockInsert }) }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn().mockReturnValue({ from: mockAdminFrom }) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (b: unknown) => new NextRequest('http://localhost/api/posts/p1/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })

// post dúvida recente (agora), sem recompensa prévia → deve creditar
function wireReward({ kind = 'duvida', author = 'other', createdAt = new Date().toISOString(), already = false } = {}) {
  mockRewardInsert.mockClear()
  mockAdminFrom.mockImplementation((t: string) => {
    if (t === 'posts') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { kind, author_id: author, created_at: createdAt } }) }) }) }
    if (t === 'medcoin_events') return {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: already ? { id: 'ev' } : null }) }) }) }),
      insert: (...a: unknown[]) => { mockRewardInsert(...a); return Promise.resolve({ error: null }) },
    }
    return {}
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'cm1' }, error: null }) }) })
  wireReward()
})
describe('comments', () => {
  it('401 sem usuário', async () => { mockGetUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(req({ body: 'oi' }), ctx('p1'))).status).toBe(401) })
  it('422 vazio', async () => { expect((await POST(req({ body: '  ' }), ctx('p1'))).status).toBe(422) })
  it('201 comenta', async () => { const res = await POST(req({ body: 'boa conduta' }), ctx('p1')); expect(res.status).toBe(201); expect((await res.json()).id).toBe('cm1') })
  it('403 se RLS barra', async () => { mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } }) }) }); expect((await POST(req({ body: 'x' }), ctx('p1'))).status).toBe(403) })
  it('credita MedCoin ao responder dúvida recente (≠ autor)', async () => {
    await POST(req({ body: 'resposta útil' }), ctx('p1'))
    expect(mockRewardInsert).toHaveBeenCalledTimes(1)
  })
  it('não credita se autor é o próprio', async () => {
    wireReward({ author: 'u1' })
    await POST(req({ body: 'respondo a mim' }), ctx('p1'))
    expect(mockRewardInsert).not.toHaveBeenCalled()
  })
  it('não credita fora da janela de 30min', async () => {
    wireReward({ createdAt: new Date(Date.now() - 60 * 60000).toISOString() })
    await POST(req({ body: 'atrasado' }), ctx('p1'))
    expect(mockRewardInsert).not.toHaveBeenCalled()
  })
  it('não credita se já houve recompensa (1x por dúvida)', async () => {
    wireReward({ already: true })
    await POST(req({ body: 'segundo' }), ctx('p1'))
    expect(mockRewardInsert).not.toHaveBeenCalled()
  })
})
