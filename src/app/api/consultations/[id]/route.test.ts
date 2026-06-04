// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockGetUser, mockUpdate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({ update: mockUpdate }),
  }),
}))

import { NextRequest } from 'next/server'
import { PATCH } from './route'

function makeRequest(body: unknown, id = 'c-1') {
  return [
    new NextRequest(`http://localhost/api/consultations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const
}

const user = { id: 'user-1' }

describe('PATCH /api/consultations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user }, error: null })
    const chain = { eq: vi.fn().mockReturnThis(), error: null }
    mockUpdate.mockReturnValue(chain)
  })

  it('retorna 401 se não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await PATCH(...makeRequest({ clinical_reasoning: 'texto' }))
    expect(res.status).toBe(401)
  })

  it('retorna 400 se clinical_reasoning não for string', async () => {
    const res = await PATCH(...makeRequest({ clinical_reasoning: 123 }))
    expect(res.status).toBe(400)
  })

  it('retorna 200 ao salvar clinical_reasoning', async () => {
    const chain = { eq: vi.fn().mockReturnThis(), error: null }
    mockUpdate.mockReturnValue(chain)
    const res = await PATCH(...makeRequest({ clinical_reasoning: 'meu pensamento' }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('retorna 500 se DB retornar erro', async () => {
    const chain = { eq: vi.fn().mockReturnThis(), error: { message: 'db error' } }
    mockUpdate.mockReturnValue(chain)
    const res = await PATCH(...makeRequest({ clinical_reasoning: 'texto' }))
    expect(res.status).toBe(500)
  })
})
