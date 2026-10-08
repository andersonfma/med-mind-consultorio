// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockFrom } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockFrom: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: mockFrom }) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/quizzes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const okOptions = [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }]

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockFrom.mockImplementation((t: string) => ({
    insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: t === 'quizzes' ? 'q1' : 'p1' }, error: null }) }) }),
  }))
})

describe('POST /api/quizzes', () => {
  it('401 sem usuário', async () => { mockGetUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(req({ prompt: 'p', options: okOptions, correctKey: 'A' }))).status).toBe(401) })
  it('422 enunciado vazio', async () => { expect((await POST(req({ prompt: ' ', options: okOptions, correctKey: 'A' }))).status).toBe(422) })
  it('422 menos de 2 alternativas', async () => { expect((await POST(req({ prompt: 'p', options: [{ key: 'A', text: 'a' }], correctKey: 'A' }))).status).toBe(422) })
  it('422 correta ausente das opções', async () => { expect((await POST(req({ prompt: 'p', options: okOptions, correctKey: 'Z' }))).status).toBe(422) })
  it('201 cria quiz + post', async () => {
    const res = await POST(req({ prompt: 'p', options: okOptions, correctKey: 'A', explanation: 'e' }))
    expect(res.status).toBe(201); const j = await res.json(); expect(j.quizId).toBe('q1'); expect(j.postId).toBe('p1')
  })
})
