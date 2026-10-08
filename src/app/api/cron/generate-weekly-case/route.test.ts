// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGen } = vi.hoisted(() => ({ mockGen: vi.fn() }))
vi.mock('@/lib/challenge/generate', () => ({ generateAndPersistNextWeek: mockGen }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn().mockReturnValue({}) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (secret?: string) => new NextRequest('http://localhost/api/cron/generate-weekly-case', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} })

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 's3cr3t'
  mockGen.mockResolvedValue({ status: 'created', weekStart: '2026-10-12' })
})

describe('POST /api/cron/generate-weekly-case', () => {
  it('401 sem/errado secret', async () => {
    expect((await POST(req())).status).toBe(401)
    expect((await POST(req('nope'))).status).toBe(401)
  })
  it('201 quando cria', async () => { expect((await POST(req('s3cr3t'))).status).toBe(201) })
  it('200 skip quando já existe', async () => {
    mockGen.mockResolvedValue({ status: 'skipped', weekStart: '2026-10-12' })
    const res = await POST(req('s3cr3t')); expect(res.status).toBe(200); expect((await res.json()).skipped).toBe(true)
  })
  it('502 se geração falha', async () => {
    mockGen.mockResolvedValue({ status: 'genfail' })
    expect((await POST(req('s3cr3t'))).status).toBe(502)
  })
})
