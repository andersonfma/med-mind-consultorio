// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockUpsert, mockDelete } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockUpsert: vi.fn(), mockDelete: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: vi.fn().mockReturnValue({ upsert: mockUpsert, delete: mockDelete }) }) }))
import { NextRequest } from 'next/server'
import { POST, DELETE } from './route'
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const r = (m: string) => new NextRequest('http://localhost/api/posts/p1/like', { method: m })
beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockUpsert.mockResolvedValue({ error: null })
  mockDelete.mockReturnValue({ eq: vi.fn().mockReturnThis() })
})
describe('like', () => {
  it('401 POST sem usuário', async () => { mockGetUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(r('POST'), ctx('p1'))).status).toBe(401) })
  it('200 curtir', async () => { expect((await POST(r('POST'), ctx('p1'))).status).toBe(200) })
  it('403 se RLS barra (upsert error)', async () => { mockUpsert.mockResolvedValue({ error: { code: '42501' } }); expect((await POST(r('POST'), ctx('p1'))).status).toBe(403) })
  it('200 descurtir', async () => { expect((await DELETE(r('DELETE'), ctx('p1'))).status).toBe(200) })
})
