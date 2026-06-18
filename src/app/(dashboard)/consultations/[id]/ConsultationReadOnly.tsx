import Link from 'next/link'
import { patientDetailRoute } from '@/lib/routes'
import { cleanExamResult } from '@/lib/exams/clean'
import type { Patient, Consultation } from '@/types/domain'
import type { ChatMessage } from '@/lib/consultations/prompts'

type ExamRow = {
  exam_name: string
  justification: string | null
  result: string | null
  status: string
}

type Ab4 = {
  a1: number; a2: number; a3: number | null; a4: number | null
  overall: number; recommendation: string; stage?: 1 | 2
}

type Props = {
  consultation: Consultation
  patient: Patient
  exams: ExamRow[]
}

const ANAMNESIS_LABELS: Record<string, string> = {
  hda: 'HDA — História da Doença Atual',
  hpp: 'HPP — História Patológica Pregressa',
  ad: 'AD — Anamnese Dirigida',
  social: 'História Social',
  familiar: 'História Familiar',
}

const PE_LABELS: Record<string, string> = {
  antropometria: 'Antropometria',
  inspecao_geral: 'Inspeção geral',
  sinais_vitais: 'Sinais vitais',
  aparelho_respiratorio: 'Aparelho respiratório',
  aparelho_cardiovascular: 'Aparelho cardiovascular',
  abdome: 'Abdome',
  membros_inferiores: 'Membros inferiores',
}

const AXES: { key: 'a1' | 'a2' | 'a3' | 'a4'; label: string; sub: string }[] = [
  { key: 'a1', label: 'A1 Poético', sub: 'Possibilidades' },
  { key: 'a2', label: 'A2 Retórico', sub: 'Plausibilidade' },
  { key: 'a3', label: 'A3 Dialético', sub: 'Confrontação' },
  { key: 'a4', label: 'A4 Analítico', sub: 'Demonstração' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{title}</h2>
      {children}
    </section>
  )
}

export function ConsultationReadOnly({ consultation, patient, exams }: Props) {
  const chat = (consultation.chat_history ?? []) as ChatMessage[]
  const anamnesis = (consultation.anamnesis ?? {}) as Record<string, string>
  const physicalExam = (consultation.physical_exam ?? {}) as Record<string, unknown>
  const reasoning = consultation.clinical_reasoning?.trim() ?? ''
  const ab4 = (consultation.ab4_score ?? null) as Ab4 | null
  const minScore = ab4
    ? Math.min(...[ab4.a1, ab4.a2, ab4.a3, ab4.a4].filter((n): n is number => typeof n === 'number'))
    : null

  const peEntries = Object.entries(PE_LABELS)
    .map(([k, label]) => [label, physicalExam[k]] as const)
    .filter(([, v]) => typeof v === 'string' && (v as string).trim())
  const extraSystems =
    physicalExam.sistemas_adicionais && typeof physicalExam.sistemas_adicionais === 'object' && !Array.isArray(physicalExam.sistemas_adicionais)
      ? (physicalExam.sistemas_adicionais as Record<string, string>)
      : {}

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link href={patientDetailRoute(patient.id)} className="text-gray-400 hover:text-gray-600 text-sm">←</Link>
          <h1 className="text-xl font-bold text-gray-900">{patient.name}</h1>
          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Modo leitura</span>
        </div>
        <p className="text-sm text-gray-500 mb-6 pl-7">
          Consulta finalizada{consultation.finished_at ? ` em ${new Date(consultation.finished_at).toLocaleDateString('pt-BR')}` : ''}
          {' · '}{patient.specialty} · {patient.difficulty}
        </p>

        {/* AB4 */}
        {ab4 && (
          <Section title="Score AB4 — raciocínio clínico">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm font-semibold text-gray-700">Geral</span>
                <span className="text-2xl font-bold text-gray-900">{ab4.overall.toFixed(1)}<span className="text-sm text-gray-400">/10</span></span>
              </div>
              {ab4.stage === 1 && (
                <p className="text-xs text-gray-400 mb-3">
                  Primeira consulta: só A1 e A2 avaliados. A3 e A4 entram na próxima consulta, com os resultados dos exames.
                </p>
              )}
              <div className="space-y-2 mb-4">
                {AXES.map(ax => {
                  const score = ab4[ax.key]
                  const pending = score === null
                  const weak = !pending && score === minScore
                  return (
                    <div key={ax.key} className="flex items-center gap-2">
                      <div className="w-28 shrink-0">
                        <span className={`text-xs font-medium ${pending ? 'text-gray-300' : 'text-gray-700'}`}>{ax.label}</span>
                        <span className="block text-[10px] text-gray-400">{ax.sub}</span>
                      </div>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        {!pending && <div className={`h-full rounded-full ${weak ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${score * 10}%` }} />}
                      </div>
                      {pending
                        ? <span className="text-[10px] text-gray-400 shrink-0">próxima consulta</span>
                        : <span className={`w-5 text-right text-sm font-semibold ${weak ? 'text-amber-600' : 'text-gray-700'}`}>{score}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">Recomendação</p>
                <p className="text-sm text-gray-700">{ab4.recommendation}</p>
              </div>
            </div>
          </Section>
        )}

        {/* Pensamento clínico */}
        <Section title="Pensamento clínico">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            {reasoning
              ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{reasoning}</p>
              : <p className="text-sm text-gray-400 italic">Não registrado nesta consulta</p>}
          </div>
        </Section>

        {/* Chat */}
        <Section title="Conversa com o paciente">
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            {chat.length === 0
              ? <p className="text-sm text-gray-400 italic">Sem mensagens.</p>
              : chat.map((m, i) => (
                  <div key={i} className={m.role === 'student' ? 'text-right' : 'text-left'}>
                    <span className={`inline-block max-w-[80%] text-sm px-3 py-2 rounded-2xl whitespace-pre-wrap ${m.role === 'student' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                      {m.content}
                    </span>
                  </div>
                ))}
          </div>
        </Section>

        {/* Anamnese */}
        <Section title="Anamnese">
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            {Object.entries(ANAMNESIS_LABELS).map(([k, label]) => (
              <div key={k}>
                <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                <p className="text-sm text-gray-700">{anamnesis[k]?.trim() || <span className="text-gray-300 italic">—</span>}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Exame físico */}
        <Section title="Exame físico">
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            {peEntries.length === 0 && Object.keys(extraSystems).length === 0
              ? <p className="text-sm text-gray-400 italic">Nenhum exame físico registrado.</p>
              : (
                <>
                  {peEntries.map(([label, v]) => (
                    <div key={label}>
                      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{v as string}</p>
                    </div>
                  ))}
                  {Object.entries(extraSystems).map(([label, v]) => (
                    <div key={label}>
                      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{v}</p>
                    </div>
                  ))}
                </>
              )}
          </div>
        </Section>

        {/* Exames */}
        <Section title="Exames solicitados">
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            {exams.length === 0
              ? <p className="text-sm text-gray-400 italic">Nenhum exame solicitado.</p>
              : exams.map((e, i) => (
                  <div key={i} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-800">{e.exam_name}</p>
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">{e.status}</span>
                    </div>
                    {e.justification?.trim() && <p className="text-xs text-gray-500 mt-0.5">Justificativa: {e.justification.trim()}</p>}
                    {e.result?.trim() && <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{cleanExamResult(e.result)}</p>}
                  </div>
                ))}
          </div>
        </Section>
      </div>
    </div>
  )
}
