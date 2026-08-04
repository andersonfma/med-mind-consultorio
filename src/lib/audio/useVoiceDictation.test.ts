import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { mockTranscribe } = vi.hoisted(() => ({ mockTranscribe: vi.fn() }))
vi.mock('./transcribe-client', () => ({
  transcribeBlob: mockTranscribe,
  appendTranscript: (c: string, t: string) => (c ? `${c} ${t}` : t),
}))

import { useVoiceDictation, isDictationSupported } from './useVoiceDictation'

// --- Mock MediaRecorder ---
class MockMediaRecorder {
  static instances: MockMediaRecorder[] = []
  static isTypeSupported() { return true }
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  state = 'inactive'
  constructor(public stream: unknown) { MockMediaRecorder.instances.push(this) }
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) })
    this.onstop?.()
  }
}

const track = { stop: vi.fn() }
const stream = { getTracks: () => [track] }

beforeEach(() => {
  vi.clearAllMocks()
  MockMediaRecorder.instances = []
  mockTranscribe.mockResolvedValue('texto ditado')
  vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder)
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('isDictationSupported', () => {
  it('true quando MediaRecorder e getUserMedia existem', () => {
    expect(isDictationSupported()).toBe(true)
  })
  it('false quando MediaRecorder não existe', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(isDictationSupported()).toBe(false)
  })
})

describe('useVoiceDictation', () => {
  it('start() coloca em recording e pede o microfone', async () => {
    const onT = vi.fn()
    const { result } = renderHook(() => useVoiceDictation(onT))
    await act(async () => { await result.current.start() })
    expect(result.current.state).toBe('recording')
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled()
  })

  it('stop() transcreve, chama onTranscript e volta a idle', async () => {
    const onT = vi.fn()
    const { result } = renderHook(() => useVoiceDictation(onT))
    await act(async () => { await result.current.start() })
    await act(async () => { result.current.stop() })
    await waitFor(() => expect(result.current.state).toBe('idle'))
    expect(mockTranscribe).toHaveBeenCalledOnce()
    expect(onT).toHaveBeenCalledWith('texto ditado')
    expect(track.stop).toHaveBeenCalled() // libera o microfone
  })

  it('permissão negada → erro e idle, sem transcrever', async () => {
    ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('denied'))
    const onT = vi.fn()
    const { result } = renderHook(() => useVoiceDictation(onT))
    await act(async () => { await result.current.start() })
    expect(result.current.state).toBe('idle')
    expect(result.current.error).toMatch(/microfone/i)
    expect(mockTranscribe).not.toHaveBeenCalled()
  })

  it('falha na transcrição → erro e idle, sem chamar onTranscript', async () => {
    mockTranscribe.mockRejectedValue(new Error('boom'))
    const onT = vi.fn()
    const { result } = renderHook(() => useVoiceDictation(onT))
    await act(async () => { await result.current.start() })
    await act(async () => { result.current.stop() })
    await waitFor(() => expect(result.current.state).toBe('idle'))
    expect(result.current.error).toMatch(/transcrever/i)
    expect(onT).not.toHaveBeenCalled()
  })
})
