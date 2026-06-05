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
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function makeRequest(body: unknown, id = 'c-1') {
  return [
    new NextRequest(`http://localhost/api/consultations/${id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const
}

const user = { id: 'user-1' }
const mockConsultation = {
  id: 'c-1',
  user_id: 'user-1',
  status: 'ongoing',
  chat_history: [],
  patients: {
    name: 'João', age: 45, gender: 'M', specialty: 'Cardiologia',
    chief_complaint: 'Dor', clinical_status: 'Estável', conditions: [], difficulty: 'easy',
  },
}

describe('POST /api/consultations/[id]/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'Estou bem.' } }] })

    // Track call count per table so we can differentiate the two consultations queries
    let consultationsCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      const updateChain = { eq: vi.fn().mockReturnThis(), error: null }
      const chain: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnValue(updateChain),
        single: vi.fn().mockImplementation(() => {
          if (table === 'consultations') {
            consultationsCallCount++
            // First call: fetch ongoing consultation; second call: fetch last finished consultation (none)
            if (consultationsCallCount === 1)
              return Promise.resolve({ data: mockConsultation, error: null })
            return Promise.resolve({ data: null, error: { code: 'PGRST116' } })
          }
          return Promise.resolve({ data: null, error: null })
        }),
      }
      return chain
    })
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(...makeRequest({ message: 'Olá' }))
    expect(res.status).toBe(401)
  })

  it('retorna 400 se message vazia', async () => {
    const res = await POST(...makeRequest({ message: '' }))
    expect(res.status).toBe(400)
  })

  it('retorna 200 com reply do paciente', async () => {
    const res = await POST(...makeRequest({ message: 'Como se sente?' }))
    expect(res.status).toBe(200)
    expect((await res.json()).reply).toBe('Estou bem.')
  })

  it('retorna 408 se OpenAI fizer timeout', async () => {
    const { APIConnectionTimeoutError } = await import('openai')
    mockCreate.mockRejectedValue(new APIConnectionTimeoutError())
    const res = await POST(...makeRequest({ message: 'Olá' }))
    expect(res.status).toBe(408)
  })

  it('retorna 500 se OpenAI erro genérico', async () => {
    mockCreate.mockRejectedValue(new Error('network'))
    const res = await POST(...makeRequest({ message: 'Olá' }))
    expect(res.status).toBe(500)
  })
})
