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

function makeRequest(id = 'c-1') {
  return [
    new NextRequest(`http://localhost/api/consultations/${id}/anamnesis`, { method: 'POST' }),
    { params: Promise.resolve({ id }) },
  ] as const
}

const user = { id: 'user-1' }
const chatHistory = [
  { role: 'student', content: 'Há quanto tempo?', timestamp: '' },
  { role: 'patient', content: 'Há 2 dias.', timestamp: '' },
]

describe('POST /api/consultations/[id]/anamnesis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            hda: 'Dor há 2 dias', hpp: '', ad: '', social: '', familiar: '',
          }),
        },
      }],
    })

    const updateChain = { eq: vi.fn().mockReturnThis(), error: null }
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { chat_history: chatHistory }, error: null,
      }),
      update: vi.fn().mockReturnValue(updateChain),
    }))
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(...makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 200 com anamnese populada', async () => {
    const res = await POST(...makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.hda).toBe('Dor há 2 dias')
    expect(json.hpp).toBe('')
  })

  it('retorna 400 se chat_history vazio', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { chat_history: [] }, error: null,
      }),
    }))
    const res = await POST(...makeRequest())
    expect(res.status).toBe(400)
  })

  it('retorna 500 se OpenAI falhar', async () => {
    mockCreate.mockRejectedValue(new Error('network'))
    const res = await POST(...makeRequest())
    expect(res.status).toBe(500)
  })
})
