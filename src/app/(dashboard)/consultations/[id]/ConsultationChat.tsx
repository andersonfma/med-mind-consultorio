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
      <div className="flex items-center gap-3 px-4 py-2 border-b text-xs text-gray-500">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} aria-label="ouvir o paciente" />
          🔊 ouvir o paciente
        </label>
        <label className="flex items-center gap-1">
          velocidade
          <select
            aria-label="velocidade"
            value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            className="border border-gray-300 rounded px-1 py-0.5"
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
          <p className="text-gray-400 text-sm text-center">Inicie a consulta cumprimentando o paciente.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${
              msg.role === 'student'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800'
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
                    className="block mt-1 text-xs text-gray-400 hover:text-gray-600"
                  >■</button>
                ) : (
                  <button
                    type="button"
                    aria-label="ouvir resposta"
                    onClick={() => { play(msg.content, voice, speed); setPlayingIdx(i) }}
                    className="block mt-1 text-xs text-gray-400 hover:text-gray-600"
                  >🔊</button>
                )
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2 text-sm text-gray-400">
              Paciente digitando...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {error && <p className="px-4 text-red-500 text-xs">{error}</p>}
      <div className="border-t p-4 flex gap-2">
        <MicButton onTranscript={(t) => setInput(prev => appendTranscript(prev, t))} />
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Digite sua mensagem..."
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="btn btn--primary px-4"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
