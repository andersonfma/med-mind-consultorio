import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSpeech } from './useSpeech'

// --- Mock de Audio ---
class MockAudio {
  static instances: MockAudio[] = []
  onended: (() => void) | null = null
  paused = true
  src: string
  constructor(src: string) { this.src = src; MockAudio.instances.push(this) }
  play() { this.paused = false; return Promise.resolve() }
  pause() { this.paused = true }
}

beforeEach(() => {
  vi.clearAllMocks()
  MockAudio.instances = []
  vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio)
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }),
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('useSpeech', () => {
  it('play() busca o áudio e entra em playing', async () => {
    const { result } = renderHook(() => useSpeech())
    await act(async () => { await result.current.play('olá', 'onyx') })
    await waitFor(() => expect(result.current.state).toBe('playing'))
    expect(fetch).toHaveBeenCalledWith('/api/speak', expect.objectContaining({ method: 'POST' }))
    expect(MockAudio.instances).toHaveLength(1)
    expect(MockAudio.instances[0].paused).toBe(false)
  })

  it('ao terminar (onended) volta a idle e revoga a URL', async () => {
    const { result } = renderHook(() => useSpeech())
    await act(async () => { await result.current.play('olá', 'onyx') })
    await act(async () => { MockAudio.instances[0].onended?.() })
    expect(result.current.state).toBe('idle')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('stop() pausa e volta a idle', async () => {
    const { result } = renderHook(() => useSpeech())
    await act(async () => { await result.current.play('olá', 'onyx') })
    await act(async () => { result.current.stop() })
    expect(result.current.state).toBe('idle')
    expect(MockAudio.instances[0].paused).toBe(true)
  })

  it('um novo play interrompe o áudio anterior', async () => {
    const { result } = renderHook(() => useSpeech())
    await act(async () => { await result.current.play('a', 'onyx') })
    await act(async () => { await result.current.play('b', 'onyx') })
    expect(MockAudio.instances).toHaveLength(2)
    expect(MockAudio.instances[0].paused).toBe(true) // o primeiro foi pausado
  })

  it('falha no fetch → idle + error, sem áudio', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 })
    const { result } = renderHook(() => useSpeech())
    await act(async () => { await result.current.play('olá', 'onyx') })
    expect(result.current.state).toBe('idle')
    expect(result.current.error).toBeTruthy()
    expect(MockAudio.instances).toHaveLength(0)
  })

  it('dois play() sobrepostos (2º inicia antes do fetch do 1º terminar): só um áudio toca, sem vazamento', async () => {
    // Fetch controlável por chamada: o 1º play() fica "preso" aguardando a rede
    // (~1-2s reais) enquanto um 2º play() é disparado (duplo clique / bolha A depois B).
    let resolveFetchA!: (v: unknown) => void
    let resolveFetchB!: (v: unknown) => void
    const fetchAPromise = new Promise(res => { resolveFetchA = res })
    const fetchBPromise = new Promise(res => { resolveFetchB = res })
    const fetchMock = vi.fn()
      .mockReturnValueOnce(fetchAPromise)
      .mockReturnValueOnce(fetchBPromise)
    vi.stubGlobal('fetch', fetchMock)
    let urlCount = 0
    const createObjectURL = vi.fn(() => `blob:mock-${++urlCount}`)
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const { result } = renderHook(() => useSpeech())

    // 1ª chamada começa e fica pendurada aguardando o fetch (audioRef/urlRef ainda vazios).
    let playA!: Promise<void>
    act(() => { playA = result.current.play('a', 'onyx') })

    // 2ª chamada começa ANTES da 1ª terminar — cenário exato do finding 1.
    let playB!: Promise<void>
    act(() => { playB = result.current.play('b', 'onyx') })

    // Os dois fetches resolvem (a ordem entre eles não deve importar: o guard usa
    // um token monotônico, não a ordem de resolução das promises).
    await act(async () => {
      resolveFetchA({ ok: true, blob: async () => new Blob([new Uint8Array([1])], { type: 'audio/mpeg' }) })
      resolveFetchB({ ok: true, blob: async () => new Blob([new Uint8Array([2])], { type: 'audio/mpeg' }) })
      await playA
      await playB
    })

    await waitFor(() => expect(result.current.state).toBe('playing'))

    // Só UM áudio existe e está tocando: a chamada antiga ('a') percebeu que ficou
    // obsoleta assim que o fetch voltou e nem chegou a criar Audio/URL — nada para vazar.
    expect(MockAudio.instances).toHaveLength(1)
    expect(MockAudio.instances[0].paused).toBe(false)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('stop() invalida um play() em andamento: ao voltar do audio.play(), não reativa "playing"', async () => {
    // Audio.play() controlável: fica pendente até o teste liberar, simulando a janela
    // entre "áudio instalado" e "audio.play() resolvida" em que um stop() pode chegar.
    let resolvePlay!: () => void
    class PendingAudio extends MockAudio {
      play() { this.paused = false; return new Promise<void>(res => { resolvePlay = res }) }
    }
    vi.stubGlobal('Audio', PendingAudio as unknown as typeof Audio)

    const { result } = renderHook(() => useSpeech())

    let playPromise!: Promise<void>
    act(() => { playPromise = result.current.play('a', 'onyx') })
    await waitFor(() => expect(MockAudio.instances).toHaveLength(1))

    // stop() chega enquanto play() ainda aguarda audio.play() resolver.
    act(() => { result.current.stop() })
    expect(result.current.state).toBe('idle')

    await act(async () => { resolvePlay(); await playPromise })

    // Não deve voltar a "playing" nem deixar o áudio antigo tocando.
    expect(result.current.state).toBe('idle')
    expect(MockAudio.instances[0].paused).toBe(true)
  })

  it('audio.play() rejeitado (ex.: autoplay bloqueado) → idle + error, sem travar em loading', async () => {
    class RejectingAudio extends MockAudio {
      play() { return Promise.reject(new Error('blocked')) }
    }
    vi.stubGlobal('Audio', RejectingAudio as unknown as typeof Audio)
    const { result } = renderHook(() => useSpeech())
    await act(async () => { await result.current.play('olá', 'onyx') })
    expect(result.current.state).toBe('idle')
    expect(result.current.error).toBeTruthy()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })
})
