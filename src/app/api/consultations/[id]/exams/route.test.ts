// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockCreate, mockGetUser, mockFrom, mockInsert } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
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
import { EXAM_REJECTION_FEEDBACK } from '@/lib/exams/exam-prompts'

const user = { id: 'user-1' }
const mockPatient = {
  id: 'p-1', name: 'João', age: 45, gender: 'M',
  specialty: 'Cardiologia', chief_complaint: 'Dor',
  conditions: [], difficulty: 'easy', clinical_status: 'Estável',
}
const mockConsultation = {
  clinical_reasoning: 'Suspeito de IAM',
  physical_exam: {
    sinais_vitais: 'PA: 140/90 mmHg',
    aparelho_cardiovascular: 'Sopro sistólico 3+/6; turgência jugular presente',
  },
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

    // O insert ecoa o payload gravado, para podermos verificar o ai_feedback de fato salvo.
    mockInsert.mockImplementation((payload: Record<string, unknown>) => ({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'er-1', ...payload }, error: null }),
    }))
    mockFrom.mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(
        table === 'consultations'
          ? { data: mockConsultation, error: null }
          : { data: null, error: null }
      ),
      insert: mockInsert,
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

  it('retorna 201 com exame aprovado e SEM feedback (não revela diagnóstico)', async () => {
    const res = await POST(...makePost({ exam_name: 'Hemograma completo', justification: 'Anemia suspeita' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.status).toBe('approved')
    // aprovado não recebe explicação — o feedback do juiz (que citaria o diagnóstico) é descartado
    expect(mockInsert.mock.calls[0][0].ai_feedback).toBe('')
    expect(json.ai_feedback).toBe('')
  })

  it('rejeitado recebe feedback genérico fixo, não o texto da IA (que citaria o diagnóstico)', async () => {
    mockCreate.mockReset()
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ approved: false, feedback: 'Sem relação com fenômeno de Raynaud' }) } }],
    })
    const res = await POST(...makePost({ exam_name: 'Colonoscopia', justification: 'sem motivo' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.status).toBe('rejected')
    expect(json.ai_feedback).toBe(EXAM_REJECTION_FEEDBACK)
    expect(json.ai_feedback).not.toContain('Raynaud')
    // rejeitado não dispara geração de laudo → só a chamada de validação
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('passa o exame físico completo (além dos sinais vitais) ao juiz', async () => {
    await POST(...makePost({ exam_name: 'Ecocardiograma', justification: 'Avaliar sopro e turgência jugular' }))
    const validationPrompt = mockCreate.mock.calls[0][0].messages[0].content as string
    expect(validationPrompt).toContain('turgência jugular')
    expect(validationPrompt).toContain('Sopro sistólico')
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
