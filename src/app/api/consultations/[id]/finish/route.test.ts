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
    new NextRequest(`http://localhost/api/consultations/${id}/finish`, {
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
  clinical_reasoning: 'Pensei em IAM',
  patients: {
    id: 'p-1',
    name: 'João', age: 45, gender: 'M', specialty: 'Cardiologia',
    chief_complaint: 'Dor', clinical_status: 'Estável', conditions: [], difficulty: 'easy',
  },
}

describe('POST /api/consultations/[id]/finish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Paciente melhorou após consulta.' } }],
    })

    const updateChain = { eq: vi.fn().mockReturnThis(), error: null }
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockConsultation, error: null }),
      update: vi.fn().mockReturnValue(updateChain),
    }))
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(...makeRequest({ diagnosis: 'IAM' }))
    expect(res.status).toBe(401)
  })

  it('retorna 400 se diagnosis ausente', async () => {
    const res = await POST(...makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('retorna 200 com patient_id ao finalizar', async () => {
    const res = await POST(...makeRequest({ diagnosis: 'IAM' }))
    expect(res.status).toBe(200)
    expect((await res.json()).patient_id).toBe('p-1')
  })

  it('retorna 500 se OpenAI falhar', async () => {
    mockCreate.mockRejectedValue(new Error('network'))
    const res = await POST(...makeRequest({ diagnosis: 'IAM' }))
    expect(res.status).toBe(500)
  })
})
