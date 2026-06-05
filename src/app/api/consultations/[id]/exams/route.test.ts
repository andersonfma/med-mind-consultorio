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
import { POST, GET } from './route'

const user = { id: 'user-1' }
const mockPatient = {
  id: 'p-1', name: 'João', age: 45, gender: 'M',
  specialty: 'Cardiologia', chief_complaint: 'Dor',
  conditions: [], difficulty: 'easy', clinical_status: 'Estável',
}
const mockConsultation = {
  clinical_reasoning: 'Suspeito de IAM',
  physical_exam: { sinais_vitais: 'PA: 140/90 mmHg' },
  patients: mockPatient,
}

function makePost(body: unknown, id = 'c-1') {
  return [
    new NextRequest(`http://localhost/api/consultations/${id}/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const
}

function makeGet(id = 'c-1') {
  return [
    new NextRequest(`http://localhost/api/consultations/${id}/exams`),
    { params: Promise.resolve({ id }) },
  ] as const
}

describe('POST /api/consultations/[id]/exams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    mockCreate
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ approved: true, feedback: 'Adequado' }) } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Hemograma: Hb 9,2 g/dL' } }],
      })

    const insertChain = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'er-1', exam_name: 'Hemograma completo', status: 'approved', attempts: 1, ai_feedback: 'Adequado', result: 'Hb 9,2' },
        error: null,
      }),
    }
    mockFrom.mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(
        table === 'consultations'
          ? { data: mockConsultation, error: null }
          : { data: null, error: null }
      ),
      insert: vi.fn().mockReturnValue(insertChain),
      order: vi.fn().mockReturnThis(),
    }))
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(...makePost({ exam_name: 'Hemograma', justification: 'teste' }))
    expect(res.status).toBe(401)
  })

  it('retorna 400 se exam_name ausente', async () => {
    const res = await POST(...makePost({ justification: 'teste' }))
    expect(res.status).toBe(400)
  })

  it('retorna 400 se justification ausente', async () => {
    const res = await POST(...makePost({ exam_name: 'ECG' }))
    expect(res.status).toBe(400)
  })

  it('retorna 201 com exame aprovado', async () => {
    const res = await POST(...makePost({ exam_name: 'Hemograma completo', justification: 'Anemia suspeita' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.status).toBe('approved')
  })

  it('retorna 409 se exame já existe na consulta', async () => {
    mockFrom.mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(
        table === 'consultations'
          ? { data: mockConsultation, error: null }
          : { data: { id: 'er-1', status: 'rejected', attempts: 1 }, error: null }
      ),
    }))
    const res = await POST(...makePost({ exam_name: 'ECG', justification: 'Dor torácica' }))
    expect(res.status).toBe(409)
  })
})

describe('GET /api/consultations/[id]/exams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [{ id: 'er-1', exam_name: 'ECG' }], error: null }),
    }))
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(...makeGet())
    expect(res.status).toBe(401)
  })

  it('retorna 200 com lista de exames', async () => {
    const res = await GET(...makeGet())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
  })
})
