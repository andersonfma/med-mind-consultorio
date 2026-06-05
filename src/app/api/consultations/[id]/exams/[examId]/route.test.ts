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
import { PUT } from './route'

const user = { id: 'user-1' }
const mockExam = {
  id: 'er-1', exam_name: 'ECG', justification: 'antiga',
  attempts: 1, status: 'rejected', ai_feedback: 'Sem indicação', result: null,
}
const mockPatient = {
  id: 'p-1', name: 'João', age: 45, gender: 'M',
  specialty: 'Cardiologia', chief_complaint: 'Dor',
  conditions: [], difficulty: 'easy', clinical_status: 'Estável',
}
const mockConsultation = {
  clinical_reasoning: 'SCA', physical_exam: {},
  patients: mockPatient,
}

function makeRequest(body: unknown, examId = 'er-1', id = 'c-1') {
  return [
    new NextRequest(`http://localhost/api/consultations/${id}/exams/${examId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id, examId }) },
  ] as const
}

describe('PUT /api/consultations/[id]/exams/[examId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ approved: true, feedback: 'Agora aprovado' }) } }],
    })
    const updateChain = { eq: vi.fn().mockReturnThis(), error: null }
    mockFrom.mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(
        table === 'exam_requests'
          ? { data: mockExam, error: null }
          : { data: mockConsultation, error: null }
      ),
      update: vi.fn().mockReturnValue(updateChain),
    }))
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await PUT(...makeRequest({ justification: 'nova' }))
    expect(res.status).toBe(401)
  })

  it('retorna 400 se justification ausente', async () => {
    const res = await PUT(...makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('retorna 409 se attempts já é 3', async () => {
    mockFrom.mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(
        table === 'exam_requests'
          ? { data: { ...mockExam, attempts: 3 }, error: null }
          : { data: mockConsultation, error: null }
      ),
    }))
    const res = await PUT(...makeRequest({ justification: 'nova' }))
    expect(res.status).toBe(409)
  })

  it('retorna 200 com attempts incrementado', async () => {
    const res = await PUT(...makeRequest({ justification: 'nova justificativa' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.attempts).toBe(2)
    expect(json.status).toBe('approved')
  })

  it('retorna 400 se exame já aprovado', async () => {
    mockFrom.mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(
        table === 'exam_requests'
          ? { data: { ...mockExam, status: 'approved' }, error: null }
          : { data: mockConsultation, error: null }
      ),
    }))
    const res = await PUT(...makeRequest({ justification: 'nova' }))
    expect(res.status).toBe(400)
  })
})
