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
  const notIdleRef = useRef(false)
  const isMountedRef = useRef(true)

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }, [])

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }, [])

  const start = useCallback(async () => {
    if (notIdleRef.current) return // já gravando/transcrevendo: evita reentrância e vazamento de mic
    notIdleRef.current = true
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      notIdleRef.current = false
      if (isMountedRef.current) {
        setError('Permissão de microfone negada')
        setState('idle')
      }
      return
    }
    streamRef.current = stream
    chunksRef.current = []
    try {
      const supported = typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(MIME)
      const recorder = new MediaRecorder(stream, supported ? { mimeType: MIME } : undefined)
      recorderRef.current = recorder
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        cleanup()
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size === 0) {
          notIdleRef.current = false
          if (isMountedRef.current) setState('idle')
          return
        }
        if (isMountedRef.current) setState('transcribing')
        try {
          const text = await transcribeBlob(blob)
          notIdleRef.current = false
          if (isMountedRef.current) {
            if (text) onTranscript(text)
            setState('idle')
          }
        } catch {
          notIdleRef.current = false
          if (isMountedRef.current) {
            setError('Não consegui transcrever, tente de novo')
            setState('idle')
          }
        }
      }
      recorder.start()
      setState('recording')
      timerRef.current = setTimeout(() => stop(), MAX_MS)
    } catch {
      // getUserMedia teve sucesso, mas o MediaRecorder falhou ao construir/iniciar
      // (ex.: mimeType inválido no navegador). Libera o stream adquirido e o timer
      // para não deixar o microfone aceso nem a gravação travada em "não idle".
      cleanup()
      notIdleRef.current = false
      if (isMountedRef.current) {
        setError('Não consegui iniciar a gravação')
        setState('idle')
      }
    }
  }, [cleanup, onTranscript, stop])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      cleanup()
    }
  }, [cleanup])

  return { state, error, start, stop }
}
