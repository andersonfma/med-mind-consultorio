// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockInsert } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockInsert: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: vi.fn().mockReturnValue({ insert: mockInsert }) }) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
beforeEach(() => { vi.clearAllMocks(); mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }); mockInsert.mockResolvedValue({ error: null }) })
describe('POST /api/reports', () => {
  it('401 sem usuário', async () => { mockGetUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(req({ targetType: 'post', targetId: 'p1' }))).status).toBe(401) })
  it('422 targetType inválido', async () => { expect((await POST(req({ targetType: 'user', targetId: 'p1' }))).status).toBe(422) })
  it('201 denuncia post', async () => { expect((await POST(req({ targetType: 'post', targetId: 'p1', reason: 'spam' }))).status).toBe(201) })
})
