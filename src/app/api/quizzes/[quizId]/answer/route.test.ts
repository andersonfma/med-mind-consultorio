// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockUserFrom, mockAdminFrom } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockUserFrom: vi.fn(), mockAdminFrom: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: mockUserFrom }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn().mockReturnValue({ from: mockAdminFrom }) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const ctx = (id: string) => ({ params: Promise.resolve({ quizId: id }) })
const req = (b: unknown) => new NextRequest('http://localhost/api/quizzes/q1/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })

function wire({ author = 'other', answered = false, correct = 'A' } = {}) {
  mockAdminFrom.mockImplementation((t: string) => {
    if (t === 'quizzes') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { author_id: author, correct_key: correct, explanation: 'e' } }) }) }) }
    if (t === 'quiz_answers') return {
      select: () => { const c: Record<string, unknown> = {}; c.eq = () => c; c.maybeSingle = () => Promise.resolve({ data: answered ? { user_id: 'u1' } : null }); c.then = (r: (v: unknown) => void) => r({ data: [{ is_correct: true }] }); return c },
    }
    return {}
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockUserFrom.mockImplementation(() => ({ insert: () => Promise.resolve({ error: null }) }))
  wire()
})

describe('POST /api/quizzes/[id]/answer', () => {
  it('401 sem usuário', async () => { mockGetUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(req({ chosenKey: 'A' }), ctx('q1'))).status).toBe(401) })
  it('404 quiz do sistema (author null)', async () => { wire({ author: null as unknown as string }); expect((await POST(req({ chosenKey: 'A' }), ctx('q1'))).status).toBe(404) })
  it('409 já respondeu', async () => { wire({ answered: true }); expect((await POST(req({ chosenKey: 'A' }), ctx('q1'))).status).toBe(409) })
  it('200 acerto', async () => { const res = await POST(req({ chosenKey: 'A' }), ctx('q1')); expect(res.status).toBe(200); const j = await res.json(); expect(j.isCorrect).toBe(true); expect(j.correctKey).toBe('A') })
})
