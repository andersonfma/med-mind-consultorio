// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockCreate, mockGetUser } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: { audio: { speech: { create: mockCreate } } },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/speak', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/speak', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    // O SDK devolve um objeto com arrayBuffer(); simulamos alguns bytes.
    mockCreate.mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })
  })

  it('401 sem auth', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(req({ text: 'olá', voice: 'onyx' }))
    expect(res.status).toBe(401)
  })

  it('sintetiza e devolve audio/mpeg', async () => {
    const res = await POST(req({ text: 'estou com dor', voice: 'onyx' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('audio/mpeg')
    expect(mockCreate).toHaveBeenCalledOnce()
    const arg = mockCreate.mock.calls[0][0]
    expect(arg.model).toBe('gpt-4o-mini-tts')
    expect(arg.voice).toBe('onyx')
    expect(arg.input).toBe('estou com dor')
  })

  it('400 quando text está vazio', async () => {
    const res = await POST(req({ text: '   ', voice: 'onyx' }))
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('400 quando text excede 4000 caracteres', async () => {
    const res = await POST(req({ text: 'a'.repeat(4001), voice: 'onyx' }))
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('500 quando a OpenAI falha (best-effort)', async () => {
    mockCreate.mockRejectedValue(new Error('boom'))
    const res = await POST(req({ text: 'olá', voice: 'onyx' }))
    expect(res.status).toBe(500)
  })
})
