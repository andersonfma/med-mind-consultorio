// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))

const { mockGetUser, mockUpdate } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockUpdate: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({ update: mockUpdate }),
  }),
}))

import { NextRequest } from 'next/server'
import { PATCH } from './route'

const req = (b: unknown) => new NextRequest('http://localhost/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
})

describe('PATCH /api/profile', () => {
  it('401 sem usuário', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await PATCH(req({ bio: 'oi' }))).status).toBe(401)
  })
  it('422 handle inválido', async () => {
    expect((await PATCH(req({ handle: 'AB' }))).status).toBe(422)
  })
  it('200 salva campos válidos', async () => {
    const res = await PATCH(req({ identity_mode: 'real', display_name: 'Ana', handle: 'ana.silva', bio: 'x', is_private: true }))
    expect(res.status).toBe(200)
  })
  it('409 em handle duplicado (23505)', async () => {
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { code: '23505' } }) })
    expect((await PATCH(req({ handle: 'ana.silva' }))).status).toBe(409)
  })
})
