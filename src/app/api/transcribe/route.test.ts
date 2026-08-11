// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockCreate, mockGetUser } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: { audio: { transcriptions: { create: mockCreate } } },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function reqWithFile(bytes = 10, name = 'audio.webm', type = 'audio/webm') {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(bytes)], name, { type }))
  return new NextRequest('http://localhost/api/transcribe', { method: 'POST', body: form })
}

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null })
    mockCreate.mockResolvedValue({ text: '  texto transcrito  ' })
  })

  it('401 sem auth', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(reqWithFile())
    expect(res.status).toBe(401)
  })

  it('transcreve e retorna o texto (trim)', async () => {
    const res = await POST(reqWithFile())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'texto transcrito' })
    expect(mockCreate).toHaveBeenCalledOnce()
    const arg = mockCreate.mock.calls[0][0]
    expect(arg.model).toBe('gpt-4o-transcribe')
    expect(arg.language).toBe('pt')
    // prompt de contexto ancora idioma (PT-BR) e vocabulário clínico — evita troca de idioma
    expect(typeof arg.prompt).toBe('string')
    expect(arg.prompt.toLowerCase()).toContain('português do brasil')
  })

  it('400 quando não há file', async () => {
    const res = await POST(new NextRequest('http://localhost/api/transcribe', {
      method: 'POST', body: new FormData(),
    }))
    expect(res.status).toBe(400)
  })

  it('400 quando o content-type não é áudio', async () => {
    const res = await POST(reqWithFile(10, 'nota.txt', 'text/plain'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'file must be audio' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('413 quando o áudio excede 5 MB', async () => {
    const res = await POST(reqWithFile(5_000_001))
    expect(res.status).toBe(413)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('500 quando a OpenAI falha (best-effort)', async () => {
    mockCreate.mockRejectedValue(new Error('boom'))
    const res = await POST(reqWithFile())
    expect(res.status).toBe(500)
  })
})
