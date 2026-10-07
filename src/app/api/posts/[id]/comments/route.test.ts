// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockInsert } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockInsert: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: vi.fn().mockReturnValue({ insert: mockInsert }) }) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (b: unknown) => new NextRequest('http://localhost/api/posts/p1/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'cm1' }, error: null }) }) })
})
describe('comments', () => {
  it('401 sem usuário', async () => { mockGetUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(req({ body: 'oi' }), ctx('p1'))).status).toBe(401) })
  it('422 vazio', async () => { expect((await POST(req({ body: '  ' }), ctx('p1'))).status).toBe(422) })
  it('201 comenta', async () => { const res = await POST(req({ body: 'boa conduta' }), ctx('p1')); expect(res.status).toBe(201); expect((await res.json()).id).toBe('cm1') })
  it('403 se RLS barra', async () => { mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } }) }) }); expect((await POST(req({ body: 'x' }), ctx('p1'))).status).toBe(403) })
})
