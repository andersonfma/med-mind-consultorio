// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockUpdate, mockDelete } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockUpdate: vi.fn(), mockDelete: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ update: mockUpdate, delete: mockDelete }) }) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/follow/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
  mockUpdate.mockReturnValue({ eq: vi.fn().mockReturnThis() })
  mockDelete.mockReturnValue({ eq: vi.fn().mockReturnThis() })
})
describe('POST /api/follow/approve', () => {
  it('401 sem usuário', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await POST(req({ followerId: 'x', accept: true }))).status).toBe(401)
  })
  it('200 aceitar', async () => { expect((await POST(req({ followerId: 'x', accept: true }))).status).toBe(200) })
  it('200 recusar', async () => { expect((await POST(req({ followerId: 'x', accept: false }))).status).toBe(200) })
})
