// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGetUser, mockUpsert, mockDelete } = vi.hoisted(() => ({ mockGetUser: vi.fn(), mockUpsert: vi.fn(), mockDelete: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: vi.fn().mockReturnValue({ upsert: mockUpsert, delete: mockDelete }) }) }))
import { NextRequest } from 'next/server'
import { POST, DELETE } from './route'
const req = (m: string, b: unknown) => new NextRequest('http://localhost/api/blocks', { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
beforeEach(() => { vi.clearAllMocks(); mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } }, error: null }); mockUpsert.mockResolvedValue({ error: null }); mockDelete.mockReturnValue({ eq: vi.fn().mockReturnThis() }) })
describe('blocks', () => {
  it('400 bloquear a si', async () => { expect((await POST(req('POST', { blockedId: 'me' }))).status).toBe(400) })
  it('200 bloquear', async () => { expect((await POST(req('POST', { blockedId: 'x' }))).status).toBe(200) })
  it('200 desbloquear', async () => { expect((await DELETE(req('DELETE', { blockedId: 'x' }))).status).toBe(200) })
})
