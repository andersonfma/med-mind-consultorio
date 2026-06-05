'use client'
import { useState, useEffect } from 'react'
import { COMMON_EXAMS } from '@/lib/exams/exam-list'
import type { ExamRequest } from '@/lib/exams/types'

type Props = {
  consultationId: string
}

export function ExamRequestPanel({ consultationId }: Props) {
  const [exams, setExams] = useState<ExamRequest[]>([])
  const [examName, setExamName] = useState('')
  const [justification, setJustification] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [retryJustification, setRetryJustification] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    fetch(`/api/consultations/${consultationId}/exams`)
      .then(r => r.json())
      .then(data => setExams(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [consultationId])

  const suggestions = examName.length > 1
    ? (COMMON_EXAMS as readonly string[]).filter(
        e => e.toLowerCase().includes(examName.toLowerCase()) && e !== examName
      ).slice(0, 5)
    : []

  async function requestExam() {
    if (!examName.trim() || !justification.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/exams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_name: examName.trim(), justification: justification.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao solicitar exame'); return }
      setExams(prev => [...prev, data as ExamRequest])
      setExamName('')
      setJustification('')
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  async function retryExam(examId: string) {
    if (!retryJustification.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/exams/${examId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justification: retryJustification.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      setExams(prev => prev.map(e =>
        e.id === examId
          ? { ...e, status: data.status, ai_feedback: data.ai_feedback, attempts: data.attempts }
          : e
      ))
      setRetryingId(null)
      setRetryJustification('')
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Request form */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={examName}
            onChange={e => { setExamName(e.target.value); setShowSuggestions(true) }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Nome do exame..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-32 overflow-y-auto">
              {suggestions.map(s => (
                <li
                  key={s}
                  onMouseDown={() => { setExamName(s); setShowSuggestions(false) }}
                  className="px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
        <textarea
          value={justification}
          onChange={e => setJustification(e.target.value)}
          placeholder="Justificativa clínica..."
          rows={2}
          maxLength={2000}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button
          onClick={requestExam}
          disabled={loading || !examName.trim() || !justification.trim()}
          className="w-full text-sm border border-gray-300 rounded-md py-1.5 hover:bg-gray-50 text-gray-600"
        >
          {loading ? 'Solicitando...' : 'Solicitar exame'}
        </button>
      </div>

      {/* Exam list */}
      {exams.length > 0 && (
        <ul className="space-y-3">
          {exams.map(exam => (
            <li key={exam.id} className="border border-gray-100 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-800">{exam.exam_name}</span>
                <div className="flex items-center gap-2">
                  {exam.status === 'rejected' && (
                    <span className={`text-xs font-mono ${exam.attempts >= 2 ? 'text-red-500' : 'text-gray-400'}`}>
                      {exam.attempts}/3
                    </span>
                  )}
                  <span className={`text-xs font-semibold ${
                    exam.status === 'approved' ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {exam.status === 'approved' ? '✓ Aprovado' : '✗ Rejeitado'}
                  </span>
                </div>
              </div>
              <p className="text-gray-500 text-xs mb-1">{exam.ai_feedback}</p>

              {exam.status === 'rejected' && exam.attempts < 3 && (
                retryingId === exam.id ? (
                  <div className="mt-2 space-y-1">
                    <textarea
                      value={retryJustification}
                      onChange={e => setRetryJustification(e.target.value)}
                      placeholder="Nova justificativa..."
                      rows={2}
                      maxLength={2000}
                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => retryExam(exam.id)}
                        disabled={loading || !retryJustification.trim()}
                        className="flex-1 text-xs border border-gray-300 rounded py-1 hover:bg-gray-50"
                      >
                        Enviar
                      </button>
                      <button
                        onClick={() => { setRetryingId(null); setRetryJustification('') }}
                        className="text-xs text-gray-400 px-2"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setRetryingId(exam.id)}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Tentar novamente
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
