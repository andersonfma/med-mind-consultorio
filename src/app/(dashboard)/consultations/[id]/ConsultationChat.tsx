'use client'
import { useState } from 'react'
import type { ChatMessage } from '@/lib/consultations/prompts'

type Props = {
  consultationId: string
  initialMessages: ChatMessage[]
  onMessagesUpdate: (messages: ChatMessage[]) => void
}

export function ConsultationChat({ consultationId, initialMessages, onMessagesUpdate }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
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
      </div>
      {error && <p className="px-4 text-red-500 text-xs">{error}</p>}
      <div className="border-t p-4 flex gap-2">
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
