'use client'
import { useState, useEffect, useRef } from 'react'
import type { ChatMessage } from '@/lib/consultations/prompts'
import { MicButton } from './MicButton'
import { appendTranscript } from '@/lib/audio/transcribe-client'
import { useSpeech } from '@/lib/audio/useSpeech'
import { voiceForGender } from '@/lib/audio/voices'

type Props = {
  consultationId: string
  initialMessages: ChatMessage[]
  onMessagesUpdate: (messages: ChatMessage[]) => void
  patientGender: string
}

export function ConsultationChat({ consultationId, initialMessages, onMessagesUpdate, patientGender }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const { state, play, stop } = useSpeech()
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)
  const [speed, setSpeed] = useState(1.25)
  const voice = voiceForGender(patientGender)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (state === 'idle') setPlayingIdx(null)
  }, [state])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    setInput('')

    const studentMsg: ChatMessage = { role: 'student', content: text, timestamp: new Date().toISOString() }
    const optimistic = [...messages, studentMsg]
    setMessages(optimistic)
    onMessagesUpdate(optimistic)

    try {
      const res = await fetch(`/api/consultations/${consultationId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao enviar mensagem'); return }

      const patientMsg: ChatMessage = { role: 'patient', content: data.reply, timestamp: new Date().toISOString() }
      const updated = [...optimistic, patientMsg]
      setMessages(updated)
      onMessagesUpdate(updated)
      if (autoSpeak) { play(data.reply, voice, speed); setPlayingIdx(updated.length - 1) }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border text-xs text-muted">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} aria-label="ouvir o paciente" className="accent-primary" />
          🔊 ouvir o paciente
        </label>
        <label className="flex items-center gap-1">
          velocidade
          <select
            aria-label="velocidade"
            value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            className="bg-surface-2 text-ink border border-border rounded px-1 py-0.5 focus:outline-none focus:border-primary"
          >
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </label>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-muted text-sm text-center">Inicie a consulta cumprimentando o paciente.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${
              msg.role === 'student'
                ? 'bg-primary text-primary-ink'
                : 'bg-surface-2 text-ink'
            }`}>
              <p className="font-semibold text-xs mb-1 opacity-70">
                {msg.role === 'student' ? 'Você' : 'Paciente'}
              </p>
              {msg.content}
              {msg.role === 'patient' && (
                playingIdx === i && state !== 'idle' ? (
                  <button
                    type="button"
                    aria-label="parar"
                    onClick={() => { stop(); setPlayingIdx(null) }}
                    className="block mt-1 text-xs text-muted hover:text-ink"
                  >■</button>
                ) : (
                  <button
                    type="button"
                    aria-label="ouvir resposta"
                    onClick={() => { play(msg.content, voice, speed); setPlayingIdx(i) }}
                    className="block mt-1 text-xs text-muted hover:text-ink"
                  >🔊</button>
                )
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-2 rounded-lg px-4 py-2 text-sm text-muted">
              Paciente digitando...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {error && <p className="px-4 text-danger text-xs">{error}</p>}
      <div className="border-t border-border p-4 flex gap-2">
        <MicButton onTranscript={(t) => setInput(prev => appendTranscript(prev, t))} />
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Digite sua mensagem..."
          className="flex-1 bg-surface-2 text-ink placeholder:text-muted border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink shadow-[var(--shadow-button)] transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
