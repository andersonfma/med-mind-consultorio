// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockGetUser, mockSelect, mockInsert } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockSelect = vi.fn()
  const mockInsert = vi.fn()
  return { mockGetUser, mockSelect, mockInsert }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
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

  it('retorna 200 com id existente se consulta ongoing já existe', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'existing-id' }, error: null }),
    })
    const res = await POST(makeRequest({ patient_id: 'p-1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe('existing-id')
  })

  it('retorna 201 com novo id ao criar consulta', async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockSelect.mockReturnValueOnce(selectChain)
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
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'race-id' }, error: null }),
    }
    mockSelect.mockReturnValue(selectChain)
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
