// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockProfileSelect, mockUpsert, mockDelete } = vi.hoisted(() => ({
  mockGetUser: vi.fn(), mockProfileSelect: vi.fn(), mockUpsert: vi.fn(), mockDelete: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockImplementation((t: string) => t === 'profiles'
      ? { select: mockProfileSelect }
      : { upsert: mockUpsert, delete: mockDelete }),
  }),
}))
import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (m: string, b: unknown) => new NextRequest('http://localhost/api/follow', { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } }, error: null })
  mockProfileSelect.mockReturnValue({ eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { is_private: false }, error: null }) })
  mockUpsert.mockResolvedValue({ error: null })
  mockDelete.mockReturnValue({ eq: vi.fn().mockReturnThis() })
})

describe('POST /api/follow', () => {
  it('400 seguir a si mesmo', async () => {
    expect((await POST(req('POST', { followeeId: 'me' }))).status).toBe(400)
  })
  it('accepted quando perfil público', async () => {
    const res = await POST(req('POST', { followeeId: 'other' }))
    expect(res.status).toBe(200); expect((await res.json()).status).toBe('accepted')
  })
  it('pending quando perfil privado', async () => {
    mockProfileSelect.mockReturnValue({ eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { is_private: true }, error: null }) })
    const res = await POST(req('POST', { followeeId: 'other' }))
    expect((await res.json()).status).toBe('pending')
  })
})
