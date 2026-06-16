// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockCreate, mockRpc, mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockRpc: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: { chat: { completions: { create: mockCreate } } },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validOpenAIResponse = {
  choices: [{
    message: {
      content: JSON.stringify({
        name: 'João Silva',
        age: 45,
        gender: 'M',
        chief_complaint: 'Dor no peito há 2 dias',
        clinical_status: 'Paciente estável, consciente e orientado',
        conditions: ['HAS', 'DM'],
        true_diagnosis: 'Síndrome Coronariana Aguda',
      }),
    },
  }],
}

const validPatient = { id: 'patient-uuid-123', name: 'João Silva', age: 45, gender: 'M' }
const authenticatedUser = { id: 'user-123', email: 'test@example.com' }

describe('POST /api/patients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: authenticatedUser }, error: null })
    // Chainable mock: from('patients').select(...).eq(...) resolves with { data: [] }
    // and from('patients').update(...).eq(...).eq(...) resolves with { error: null }
    const eqChain: Record<string, unknown> = {}
    eqChain.eq = vi.fn().mockReturnValue({ ...eqChain, error: null, data: [] })
    Object.assign(eqChain, {
      then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
    })
    // Make eq().eq() and eq().order() also work (order resolve com lista vazia de pacientes)
    const eqFn = vi.fn().mockImplementation(() => ({
      eq: eqFn,
      order: vi.fn().mockReturnValue({
        data: [],
        error: null,
        then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      }),
      error: null,
      data: [],
      then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
    }))
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({ eq: eqFn }),
      update: vi.fn().mockReturnValue({ eq: eqFn }),
    }))
  })

  it('retorna 400 se specialty for inválida', async () => {
    const res = await POST(makeRequest({ specialty: 'Pediatria', difficulty: 'easy' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid specialty')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('retorna 400 se difficulty for inválida', async () => {
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'extreme' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid difficulty')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('retorna 400 se body for JSON inválido', async () => {
    const req = new NextRequest('http://localhost/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('retorna 401 se usuário não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(401)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('retorna 408 se OpenAI fizer timeout e não consome slot', async () => {
    const { APIConnectionTimeoutError } = await import('openai')
    mockCreate.mockRejectedValue(new APIConnectionTimeoutError())
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(408)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('retorna 500 se OpenAI lançar erro genérico e não consome slot', async () => {
    mockCreate.mockRejectedValue(new Error('network error'))
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(500)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('retorna 500 se OpenAI retornar choices vazio', async () => {
    mockCreate.mockResolvedValue({ choices: [] })
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(500)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('retorna 500 se OpenAI retornar JSON inválido e não consome slot', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'not json' } }] })
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(500)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('retorna 500 se age estiver fora de 18-80 e não consome slot', async () => {
    const badAge = { ...JSON.parse(validOpenAIResponse.choices[0].message.content), age: 10 }
    mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(badAge) } }] })
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(500)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('retorna 409 se não houver slots (US001)', async () => {
    mockCreate.mockResolvedValue(validOpenAIResponse)
    mockRpc.mockResolvedValue({ data: null, error: { code: 'US001', message: 'no slots' } })
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('No slots available')
  })

  it('retorna 201 com o paciente criado', async () => {
    mockCreate.mockResolvedValue(validOpenAIResponse)
    mockRpc.mockResolvedValue({ data: validPatient, error: null })
    const res = await POST(makeRequest({ specialty: 'Cardiologia', difficulty: 'easy' }))
    expect(res.status).toBe(201)
    expect((await res.json()).id).toBe('patient-uuid-123')
  })

  it('passa specialty e difficulty do body ao RPC (não do OpenAI)', async () => {
    mockCreate.mockResolvedValue(validOpenAIResponse)
    mockRpc.mockResolvedValue({ data: validPatient, error: null })
    await POST(makeRequest({ specialty: 'Neurologia', difficulty: 'hard' }))
    expect(mockRpc).toHaveBeenCalledWith('create_patient', expect.objectContaining({
      p_specialty: 'Neurologia',
      p_difficulty: 'hard',
    }))
  })
})
