// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockGetUser, mockPatientSelect, mockConsultationSelect, mockInsert } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockPatientSelect = vi.fn()
  const mockConsultationSelect = vi.fn()
  const mockInsert = vi.fn()
  return { mockGetUser, mockPatientSelect, mockConsultationSelect, mockInsert }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'patients') {
        return { select: mockPatientSelect }
      }
      return { select: mockConsultationSelect, insert: mockInsert }
    }),
  }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/consultations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const user = { id: 'user-123' }

// Default patient ownership check: returns a valid patient
function mockPatientFound() {
  mockPatientSelect.mockReturnValue({
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'p-1' }, error: null }),
  })
}

describe('POST /api/consultations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
  })

  it('retorna 400 se patient_id ausente', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest({ patient_id: 'p-1' }))
    expect(res.status).toBe(401)
  })

  it('retorna 403 se paciente não pertence ao usuário', async () => {
    // mockPatientSelect returns null for patient ownership check
    mockPatientSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
    const res = await POST(makeRequest({ patient_id: 'other-user-patient' }))
    expect(res.status).toBe(403)
  })

  it('retorna 200 com id existente se consulta ongoing já existe', async () => {
    mockPatientFound()
    mockConsultationSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'existing-id' }, error: null }),
    })
    const res = await POST(makeRequest({ patient_id: 'p-1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe('existing-id')
  })

  it('retorna 201 com novo id ao criar consulta', async () => {
    mockPatientFound()
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockConsultationSelect.mockReturnValueOnce(selectChain)
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
      }),
    })
    const res = await POST(makeRequest({ patient_id: 'p-1' }))
    expect(res.status).toBe(201)
    expect((await res.json()).id).toBe('new-id')
  })

  it('retorna 200 ao capturar race condition (UNIQUE VIOLATION 23505)', async () => {
    mockPatientFound()
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'race-id' }, error: null }),
    }
    mockConsultationSelect.mockReturnValue(selectChain)
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
      }),
    })
    const res = await POST(makeRequest({ patient_id: 'p-1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe('race-id')
  })
})
