'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export type SpeechState = 'idle' | 'loading' | 'playing'

export function useSpeech() {
  const [state, setState] = useState<SpeechState>('idle')
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
  }, [])

  const stop = useCallback(() => {
    cleanupAudio()
    if (mountedRef.current) setState('idle')
  }, [cleanupAudio])

  const play = useCallback(async (text: string, voice: string) => {
    cleanupAudio()                     // interrompe qualquer áudio anterior
    setError(null)
    setState('loading')
    let blob: Blob
    try {
      const res = await fetch('/api/speak', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      })
      if (!res.ok) throw new Error(`speak failed: ${res.status}`)
      blob = await res.blob()
    } catch {
      if (mountedRef.current) { setError('Não consegui gerar o áudio'); setState('idle') }
      return
    }
    if (!mountedRef.current) return
    const url = URL.createObjectURL(blob)
    urlRef.current = url
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => { cleanupAudio(); if (mountedRef.current) setState('idle') }
    try {
      await audio.play()
    } catch {
      cleanupAudio()
      if (mountedRef.current) { setError('Não consegui reproduzir o áudio'); setState('idle') }
      return
    }
    if (mountedRef.current) setState('playing')
  }, [cleanupAudio])

  useEffect(() => () => { mountedRef.current = false; cleanupAudio() }, [cleanupAudio])

  return { state, error, play, stop }
}
