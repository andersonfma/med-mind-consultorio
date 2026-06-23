// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockCreate, mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: { chat: { completions: { create: mockCreate } } },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser }, from: mockFrom }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function makeRequest(body: unknown, id = 'c-1') {
  return [
    new NextRequest(`http://localhost/api/consultations/${id}/prescriptions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const
}

const user = { id: 'user-1' }
const consultation = {
  clinical_reasoning: '', patients: {
    id: 'p-1', name: 'João', age: 50, gender: 'M', specialty: 'Cardiologia',
    chief_complaint: 'dor', clinical_status: 'estável', conditions: [], difficulty: 'easy',
    true_diagnosis: 'Hipertensão arterial', case_summary: null,
  },
}

function makeFrom(opts: { consultation?: unknown; inserted?: unknown } = {}) {
  return () => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.order = vi.fn(() => Promise.resolve({ data: [], error: null }))
    chain.single = vi.fn().mockResolvedValue({ data: opts.consultation ?? consultation, error: null })
    chain.insert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: opts.inserted ?? { id: 'rx-1' }, error: null }) })) }))
    return chain
  }
}

describe('POST /api/consultations/[id]/prescriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    mockFrom.mockImplementation(makeFrom())
    mockCreate.mockResolvedValue({ choices: [{ message: { content: '{"adequacy":"adequada","feedback":"ok"}' } }] })
  })

  it('401 sem auth', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(...makeRequest({ drug_name: 'Losartana', posology: '50 mg' }))
    expect(res.status).toBe(401)
  })

  it('400 sem drug_name', async () => {
    const res = await POST(...makeRequest({ posology: '50 mg' }))
    expect(res.status).toBe(400)
  })

  it('201 com adequacy calculada pela IA', async () => {
    const res = await POST(...makeRequest({ drug_name: 'Losartana', posology: '50 mg VO 1x/dia', source: 'catalog' }))
    expect(res.status).toBe(201)
  })

  it('salva com adequacy null quando a IA falha (best-effort)', async () => {
    mockCreate.mockRejectedValue(new Error('timeout'))
    const insertSpy = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'rx-2', adequacy: null }, error: null }) })) }))
    mockFrom.mockImplementation(() => {
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.order = vi.fn(() => Promise.resolve({ data: [], error: null }))
      chain.single = vi.fn().mockResolvedValue({ data: consultation, error: null })
      chain.insert = insertSpy
      return chain
    })
    const res = await POST(...makeRequest({ drug_name: 'Coisa estranha', posology: 'x' }))
    expect(res.status).toBe(201)
    expect(insertSpy).toHaveBeenCalled()
  })
})
