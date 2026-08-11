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

function makeRequest(id = 'p-1') {
  return [
    new NextRequest(`http://localhost/api/patients/${id}/reveal-diagnosis`, { method: 'POST' }),
    { params: Promise.resolve({ id }) },
  ] as const
}

const user = { id: 'user-1' }

type Fixtures = {
  patient?: Record<string, unknown>
  patientError?: unknown
  consultCount?: number
  examCount?: number
  lastConsult?: Record<string, unknown> | null
  exams?: Array<{ exam_name: string; result: string | null }>
  updateError?: unknown
}

const defaultPatient = {
  id: 'p-1', name: 'Dionísia', age: 62, gender: 'F', specialty: 'Gastroenterologia',
  chief_complaint: 'Icterícia', conditions: [], difficulty: 'hard',
  diagnosis_status: 'none', true_diagnosis: null,
}

const defaultLastConsult = {
  id: 'c-2',
  chat_history: [],
  anamnesis: { hda: 'Icterícia progressiva há 3 semanas' },
  physical_exam: { sinais_vitais: 'PA 120/80' },
  clinical_reasoning: 'Neoplasia de cabeça de pâncreas com colestase obstrutiva',
}

// Mock encadeável ciente da tabela. Cada .from(table) devolve uma cadeia nova.
// - queries de contagem (select com { count: 'exact' }) resolvem { count } ao serem aguardadas
// - patient/lastConsult resolvem via .single()
// - listas (exames) e updates resolvem ao serem aguardadas
function makeFrom(fx: Fixtures = {}) {
  return (table: string) => {
    const chain: Record<string, unknown> = {}
    let isCount = false
    let isUpdate = false
    chain.select = (_cols: unknown, opts?: { count?: string }) => { isCount = opts?.count === 'exact'; return chain }
    chain.update = () => { isUpdate = true; return chain }
    chain.eq = () => chain
    chain.neq = () => chain
    chain.not = () => chain
    chain.order = () => chain
    chain.limit = () => chain
    chain.single = () => {
      if (table === 'patients')
        return Promise.resolve({ data: fx.patient ?? defaultPatient, error: fx.patientError ?? null })
      if (table === 'consultations')
        return Promise.resolve({ data: fx.lastConsult === undefined ? defaultLastConsult : fx.lastConsult, error: null })
      return Promise.resolve({ data: null, error: null })
    }
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      let value: unknown
      if (isUpdate) value = { error: fx.updateError ?? null }
      else if (isCount) value = { count: table === 'consultations' ? (fx.consultCount ?? 2) : (fx.examCount ?? 1) }
      else if (table === 'exam_requests') value = { data: fx.exams ?? [], error: null }
      else value = { data: [], error: null }
      return Promise.resolve(value).then(resolve, reject)
    }
    return chain
  }
}

describe('POST /api/patients/[id]/reveal-diagnosis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    mockFrom.mockImplementation(makeFrom())
    // default: eval (compatível) + resumo clínico
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ true_diagnosis: 'Neoplasia de cabeça de pâncreas', compatible: true }) } }] })
      .mockResolvedValue({ choices: [{ message: { content: 'Resumo educativo.' } }] })
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(...makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 se houver menos de 2 consultas finalizadas', async () => {
    mockFrom.mockImplementation(makeFrom({ consultCount: 1 }))
    const res = await POST(...makeRequest())
    expect(res.status).toBe(403)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('retorna 403 se não houver exame aprovado', async () => {
    mockFrom.mockImplementation(makeFrom({ examCount: 0 }))
    const res = await POST(...makeRequest())
    expect(res.status).toBe(403)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('retorna 409 se o diagnóstico já foi concluído antes', async () => {
    mockFrom.mockImplementation(makeFrom({ patient: { ...defaultPatient, diagnosis_status: 'achieved' } }))
    const res = await POST(...makeRequest())
    expect(res.status).toBe(409)
  })

  it("marca 'achieved' quando o raciocínio do aluno é compatível", async () => {
    const res = await POST(...makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json() as { diagnosis_status: string; true_diagnosis: string }
    expect(body.diagnosis_status).toBe('achieved')
  })

  it("marca 'revealed' quando o raciocínio do aluno NÃO é compatível", async () => {
    mockCreate.mockReset()
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ true_diagnosis: 'Neoplasia de cabeça de pâncreas', compatible: false }) } }] })
      .mockResolvedValue({ choices: [{ message: { content: 'Resumo educativo.' } }] })
    const res = await POST(...makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json() as { diagnosis_status: string }
    expect(body.diagnosis_status).toBe('revealed')
  })

  it("nunca marca 'achieved' quando o aluno não registrou pensamento clínico (mesmo com IA dizendo compatível)", async () => {
    mockFrom.mockImplementation(makeFrom({ lastConsult: { ...defaultLastConsult, clinical_reasoning: '   ' } }))
    // IA (erroneamente) diria compatível, mas sem raciocínio registrado não há o que creditar
    const res = await POST(...makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json() as { diagnosis_status: string }
    expect(body.diagnosis_status).toBe('revealed')
  })

  it('retorna 500 se a avaliação da OpenAI falhar', async () => {
    mockCreate.mockReset()
    mockCreate.mockRejectedValue(new Error('network'))
    const res = await POST(...makeRequest())
    expect(res.status).toBe(500)
  })
})
