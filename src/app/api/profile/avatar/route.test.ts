// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))

const { mockGetUser, mockCreateSignedUploadUrl, mockGetPublicUrl, mockUpdate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(), mockCreateSignedUploadUrl: vi.fn(), mockGetPublicUrl: vi.fn(), mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    storage: { from: vi.fn().mockReturnValue({ createSignedUploadUrl: mockCreateSignedUploadUrl, getPublicUrl: mockGetPublicUrl }) },
    from: vi.fn().mockReturnValue({ update: mockUpdate }),
  }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/profile/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockCreateSignedUploadUrl.mockResolvedValue({ data: { signedUrl: 'http://up', token: 'tok', path: 'u1.png' }, error: null })
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'http://pub/u1.png' } })
  mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
})

describe('POST /api/profile/avatar', () => {
  it('401 sem usuário', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await POST(req({ contentType: 'image/png' }))).status).toBe(401)
  })
  it('415 se não for imagem', async () => {
    expect((await POST(req({ contentType: 'application/pdf' }))).status).toBe(415)
  })
  it('200 retorna uploadUrl e publicUrl e grava avatar_url', async () => {
    const res = await POST(req({ contentType: 'image/png' }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.uploadUrl).toBe('http://up'); expect(j.publicUrl).toBe('http://pub/u1.png')
  })
})
