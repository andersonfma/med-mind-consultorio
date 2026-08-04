import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { transcribeBlob, appendTranscript } from './transcribe-client'

describe('appendTranscript', () => {
  it('anexa com um espaço quando já há texto', () => {
    expect(appendTranscript('Paciente estável', 'sem queixas')).toBe('Paciente estável sem queixas')
  })
  it('usa só o texto novo quando o atual está vazio', () => {
    expect(appendTranscript('', 'primeira frase')).toBe('primeira frase')
    expect(appendTranscript('   ', 'x')).toBe('x')
  })
  it('texto novo vazio não altera o atual', () => {
    expect(appendTranscript('abc', '   ')).toBe('abc')
  })
})

describe('transcribeBlob', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('faz POST para /api/transcribe e devolve o texto', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ text: 'raciocínio ditado' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const out = await transcribeBlob(new Blob(['x'], { type: 'audio/webm' }))
    expect(out).toBe('raciocínio ditado')
    expect(fetchMock).toHaveBeenCalledWith('/api/transcribe', expect.objectContaining({ method: 'POST' }))
  })

  it('lança quando a resposta não é ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }))
    await expect(transcribeBlob(new Blob(['x']))).rejects.toThrow()
  })
})
