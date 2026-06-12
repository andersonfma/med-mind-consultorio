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
    const res = await POST(...makeRequest({}))
    expect(res.status).toBe(401)
  })

  it('retorna 200 com patient_id ao finalizar (sem campo diagnosis)', async () => {
    const res = await POST(...makeRequest({}))
    expect(res.status).toBe(200)
    expect((await res.json()).patient_id).toBe('p-1')
  })

  it('retorna 500 se OpenAI falhar', async () => {
    mockCreate.mockRejectedValue(new Error('network'))
    const res = await POST(...makeRequest({ diagnosis: 'IAM' }))
    expect(res.status).toBe(500)
  })

  it('retorna ab4 calculado quando AB4 call retorna JSON válido', async () => {
    const ab4Json = '{"a1":7,"a2":8,"a3":5,"a4":8,"recommendation":"foco no A3"}'
    // Call 1: clinical_status (finish prompt), Call 2: case summary, Call 3: AB4
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Paciente melhorou.' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Resumo do caso.' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: ab4Json } }] })

    const res = await POST(...makeRequest({}))
    expect(res.status).toBe(200)
    const body = await res.json() as { patient_id: string; diagnosis_achieved: boolean; ab4: { overall: number; recommendation: string } | null }
    expect(body.ab4).not.toBeNull()
    expect(body.ab4?.overall).toBe(7)
    expect(body.ab4?.recommendation).toBe('foco no A3')
  })

  it('retorna ab4=null e status 200 quando AB4 call lança erro', async () => {
    // Call 1: clinical_status (finish prompt), Call 2: case summary, Call 3: AB4 throws
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Paciente melhorou.' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Resumo do caso.' } }] })
      .mockRejectedValueOnce(new Error('AB4 timeout'))

    const res = await POST(...makeRequest({}))
    expect(res.status).toBe(200)
    const body = await res.json() as { patient_id: string; diagnosis_achieved: boolean; ab4: null }
    expect(body.ab4).toBeNull()
  })

  it('usa o clinical_reasoning enviado no corpo quando o DB ainda está vazio (corrige a corrida do autosave)', async () => {
    // DB ainda não persistiu o texto (autosave de 30s não disparou), mas o cliente o envia no corpo
    const dbEmpty = { ...mockConsultation, clinical_reasoning: '' }
    const updateChain = { eq: vi.fn().mockReturnThis(), error: null }
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: dbEmpty, error: null }),
      update: vi.fn().mockReturnValue(updateChain),
    }))
    const ab4Json = '{"a1":6,"a2":6,"a3":6,"a4":6,"recommendation":"ok"}'
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Paciente melhorou.' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Resumo.' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: ab4Json } }] })

    const res = await POST(...makeRequest({ clinical_reasoning: 'Raciocínio completo escrito pelo aluno' }))
    expect(res.status).toBe(200)
    const body = await res.json() as { ab4: { overall: number } | null }
    expect(body.ab4).not.toBeNull()
    expect(body.ab4?.overall).toBe(6) // juiz AB4 foi chamado, NÃO zerado
  })

  it('zera o ab4 (overall 0) quando o pensamento clínico está vazio e NÃO chama o juiz AB4', async () => {
    const emptyConsultation = { ...mockConsultation, clinical_reasoning: '   ' }
    const updateChain = { eq: vi.fn().mockReturnThis(), error: null }
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: emptyConsultation, error: null }),
      update: vi.fn().mockReturnValue(updateChain),
    }))

    const res = await POST(...makeRequest({}))
    expect(res.status).toBe(200)
    const body = await res.json() as { ab4: { overall: number; a1: number; a4: number } | null }
    expect(body.ab4).not.toBeNull()
    expect(body.ab4?.overall).toBe(0)
    expect(body.ab4?.a1).toBe(0)
    expect(body.ab4?.a4).toBe(0)
    // só clinical_status + case_summary são chamados; o juiz AB4 NÃO é chamado
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })
})
