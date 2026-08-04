'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { transcribeBlob } from './transcribe-client'

export type DictationState = 'idle' | 'recording' | 'transcribing'

const MAX_MS = 120_000
const MIME = 'audio/webm;codecs=opus'

export function isDictationSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && !!navigator?.mediaDevices?.getUserMedia
}

export function useVoiceDictation(onTranscript: (text: string) => void) {
  const [state, setState] = useState<DictationState>('idle')
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }, [])

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }, [])

  const start = useCallback(async () => {
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Permissão de microfone negada')
      setState('idle')
      return
    }
    streamRef.current = stream
    chunksRef.current = []
    const supported = typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(MIME)
    const recorder = new MediaRecorder(stream, supported ? { mimeType: MIME } : undefined)
    recorderRef.current = recorder
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = async () => {
      cleanup()
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      if (blob.size === 0) { setState('idle'); return }
      setState('transcribing')
      try {
        const text = await transcribeBlob(blob)
        if (text) onTranscript(text)
        setState('idle')
      } catch {
        setError('Não consegui transcrever, tente de novo')
        setState('idle')
      }
    }
    recorder.start()
    setState('recording')
    timerRef.current = setTimeout(() => stop(), MAX_MS)
  }, [cleanup, onTranscript, stop])

  useEffect(() => cleanup, [cleanup])

  return { state, error, start, stop }
}
