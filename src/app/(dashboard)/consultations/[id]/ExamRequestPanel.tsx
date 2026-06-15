'use client'
import { useState, useEffect } from 'react'
import { COMMON_EXAMS } from '@/lib/exams/exam-list'
import { cleanExamResult } from '@/lib/exams/clean'
import type { ExamRequest } from '@/lib/exams/types'

type Props = {
  consultationId: string
  previousExamResults?: Array<{ exam_name: string; result: string | null }>
}

export function ExamRequestPanel({ consultationId, previousExamResults = [] }: Props) {
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
    <div className="p-3 space-y-3">
      {/* Previous exam results */}
      {previousExamResults.length > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
            Resultados anteriores
          </p>
          {previousExamResults.map((exam, i) => (
            <div key={i} className="bg-white rounded p-2">
              <p className="text-xs font-semibold text-gray-700 mb-1">{exam.exam_name}</p>
              {exam.result ? (
                <pre className="text-xs text-gray-600 font-sans whitespace-pre-wrap leading-relaxed">
                  {cleanExamResult(exam.result)}
                </pre>
              ) : (
                <p className="text-xs text-gray-400 italic">Laudo não disponível</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Request form */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={examName}
            onChange={e => { setExamName(e.target.value); setShowSuggestions(true) }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Nome do exame..."
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
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
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm resize-none"
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button
          onClick={requestExam}
          disabled={loading || !examName.trim() || !justification.trim()}
          className="w-full text-xs bg-gray-100 hover:bg-gray-200 rounded-md py-1.5 text-gray-600 font-medium"
        >
          {loading ? 'Solicitando...' : '+ Solicitar exame'}
        </button>
      </div>

      {/* Exam list */}
      {exams.length > 0 && (
        <div className="space-y-1.5">
          {exams.map(exam => (
            <div key={exam.id} className="rounded-md px-3 py-2 bg-gray-50 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-800">{exam.exam_name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {exam.status === 'rejected' && exam.attempts > 1 && (
                    <span className={`text-xs ${exam.attempts >= 2 ? 'text-red-400' : 'text-gray-400'}`}>
                      {exam.attempts}/3
                    </span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    exam.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {exam.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                  </span>
                </div>
              </div>
              {exam.ai_feedback && (
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{exam.ai_feedback}</p>
              )}

              {exam.status === 'rejected' && exam.attempts < 3 && (
                retryingId === exam.id ? (
                  <div className="mt-2 space-y-1">
                    <textarea
                      value={retryJustification}
                      onChange={e => setRetryJustification(e.target.value)}
                      placeholder="Nova justificativa..."
                      rows={2}
                      maxLength={2000}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => retryExam(exam.id)}
                        disabled={loading || !retryJustification.trim()}
                        className="flex-1 text-xs bg-gray-100 rounded py-1 hover:bg-gray-200"
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
