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
})
