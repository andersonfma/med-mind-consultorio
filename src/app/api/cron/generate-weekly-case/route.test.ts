// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const { mockGen, mockFrom } = vi.hoisted(() => ({ mockGen: vi.fn(), mockFrom: vi.fn() }))
vi.mock('@/lib/challenge/generate', () => ({ generateWeeklyCase: mockGen }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn().mockReturnValue({ from: mockFrom }) }))
import { NextRequest } from 'next/server'
import { POST } from './route'
const req = (secret?: string) => new NextRequest('http://localhost/api/cron/generate-weekly-case', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} })

function wireNoExisting() {
  mockFrom.mockImplementation((t: string) => {
    if (t === 'weekly_cases') return {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'wc1' }, error: null }) }) }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }
    if (t === 'quizzes') return { insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'q' }, error: null }) }) }) }
    return { insert: vi.fn().mockResolvedValue({ error: null }) } // challenge_days
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 's3cr3t'
  wireNoExisting()
  mockGen.mockResolvedValue({ title: 't', true_diagnosis: 'd', overview: 'o', review: 'r', days: Array.from({ length: 5 }, (_, i) => ({ day_index: i + 1, stage: ['anamnese', 'exame', 'complementares', 'conduta', 'conclusao'][i], narrative: 'n', quiz: { prompt: 'p', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], correct_key: 'A', explanation: 'e' } })) })
})

describe('POST /api/cron/generate-weekly-case', () => {
  it('401 sem/errado secret', async () => {
    expect((await POST(req())).status).toBe(401)
    expect((await POST(req('nope'))).status).toBe(401)
  })
  it('201 gera quando não existe', async () => {
    expect((await POST(req('s3cr3t'))).status).toBe(201)
  })
  it('200 skip quando já existe', async () => {
    mockFrom.mockImplementation(() => ({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'exists' } }) }) }) }))
    const res = await POST(req('s3cr3t')); expect(res.status).toBe(200); expect((await res.json()).skipped).toBe(true)
  })
  it('502 se geração falha', async () => {
    mockGen.mockResolvedValue(null)
    expect((await POST(req('s3cr3t'))).status).toBe(502)
  })
})
