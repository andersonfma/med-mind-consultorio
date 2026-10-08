// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockSigned, mockPublic } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockSigned: vi.fn(), mockPublic: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn().mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ createSignedUploadUrl: mockSigned, getPublicUrl: mockPublic }) } }) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/posts/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockSigned.mockResolvedValue({ data: { signedUrl: 'http://up' }, error: null })
  mockPublic.mockReturnValue({ data: { publicUrl: 'http://pub/x.png' } })
})
describe('POST /api/posts/image', () => {
  it('401 sem usuário', async () => { mockGetUser.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(req({ contentType: 'image/png' }))).status).toBe(401) })
  it('415 não imagem', async () => { expect((await POST(req({ contentType: 'application/pdf' }))).status).toBe(415) })
  it('200 uploadUrl + publicUrl', async () => { const res = await POST(req({ contentType: 'image/png' })); expect(res.status).toBe(200); const j = await res.json(); expect(j.uploadUrl).toBe('http://up'); expect(j.publicUrl).toBe('http://pub/x.png') })
})
