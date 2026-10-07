// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockConsultSelect, mockInsert } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockConsultSelect: vi.fn(), mockInsert: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockImplementation((t: string) => t === 'consultations' ? { select: mockConsultSelect } : { insert: mockInsert }),
  }),
}))
import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockConsultSelect.mockReturnValue({ eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'c1', status: 'finished' }, error: null }) })
  mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'post1' }, error: null }) }) })
})
describe('POST /api/posts', () => {
  it('401 sem usuário', async () => { mockGetUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(req({ kind: 'text', body: 'x' }))).status).toBe(401) })
  it('422 card sem referência', async () => { expect((await POST(req({ kind: 'card' }))).status).toBe(422) })
  it('422 text sem body', async () => { expect((await POST(req({ kind: 'text', body: '   ' }))).status).toBe(422) })
  it('403 card de consulta que não é do usuário ou não finalizada', async () => {
    mockConsultSelect.mockReturnValue({ eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })
    expect((await POST(req({ kind: 'card', consultationId: 'c1' }))).status).toBe(403)
  })
  it('201 card de consulta finalizada', async () => {
    const res = await POST(req({ kind: 'card', consultationId: 'c1', body: 'mandei bem' }))
    expect(res.status).toBe(201); expect((await res.json()).id).toBe('post1')
  })
  it('201 text', async () => { expect((await POST(req({ kind: 'text', body: 'dúvida sobre ICC' }))).status).toBe(201) })
})
