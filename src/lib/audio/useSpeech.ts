'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export type SpeechState = 'idle' | 'loading' | 'playing'

export function useSpeech() {
  const [state, setState] = useState<SpeechState>('idle')
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  // Token de requisição: incrementado a cada play()/stop(). Uma chamada só pode
  // instalar seu áudio/URL e mudar o estado se seu token ainda for o mais recente
  // no momento em que termina cada await — evita que um play() "atrasado" pise
  // no áudio de um play() mais novo (corrida) ou vaze um object URL.
  const tokenRef = useRef(0)

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
  }, [])

  const stop = useCallback(() => {
    tokenRef.current++            // invalida qualquer play() em andamento
    cleanupAudio()
    if (mountedRef.current) setState('idle')
  }, [cleanupAudio])

  const play = useCallback(async (text: string, voice: string) => {
    const myToken = ++tokenRef.current
    cleanupAudio()                     // interrompe qualquer áudio já instalado
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
      if (tokenRef.current === myToken && mountedRef.current) { setError('Não consegui gerar o áudio'); setState('idle') }
      return
    }
    if (tokenRef.current !== myToken || !mountedRef.current) return   // superado por um play()/stop() mais novo
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.onended = () => { cleanupAudio(); if (mountedRef.current) setState('idle') }
    try {
      await audio.play()
    } catch {
      URL.revokeObjectURL(url)
      if (tokenRef.current === myToken && mountedRef.current) { setError('Não consegui reproduzir o áudio'); setState('idle') }
      return
    }
    if (tokenRef.current !== myToken) {
      // um play()/stop() mais novo venceu enquanto aguardávamos audio.play(): descarta sem vazar.
      audio.pause()
      URL.revokeObjectURL(url)
      return
    }
    urlRef.current = url
    audioRef.current = audio
    if (mountedRef.current) setState('playing')
  }, [cleanupAudio])

  useEffect(() => () => { mountedRef.current = false; tokenRef.current++; cleanupAudio() }, [cleanupAudio])

  return { state, error, play, stop }
}
