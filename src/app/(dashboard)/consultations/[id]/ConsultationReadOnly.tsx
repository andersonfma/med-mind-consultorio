import Link from 'next/link'
import { patientDetailRoute } from '@/lib/routes'
import { cleanExamResult } from '@/lib/exams/clean'
import { AB4_AXES, COMM_AXES } from '@/lib/consultations/ab4-labels'
import type { Patient, Consultation } from '@/types/domain'
import type { ChatMessage } from '@/lib/consultations/prompts'

type ExamRow = {
  exam_name: string
  justification: string | null
  result: string | null
  status: string
}

type PrescriptionRow = {
  id: string
  drug_name: string
  posology: string
  kind?: string
  adequacy: string | null
  ai_feedback: string | null
  status: string
}

type Ab4 = {
  a1: number; a2: number; a3: number | null; a4: number | null
  overall: number; recommendation: string; stage?: 1 | 2
}

type Communication = { c1: number; c2: number; c3: number; overall: number; recommendation: string }

type Props = {
  consultation: Consultation
  patient: Patient
  exams: ExamRow[]
  prescriptions: PrescriptionRow[]
}

const ADEQUACY_LABEL: Record<string, { text: string; cls: string }> = {
  adequada: { text: 'adequada', cls: 'text-success' },
  parcial: { text: 'parcial', cls: 'text-warning' },
  inadequada: { text: 'inadequada', cls: 'text-danger' },
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-xs font-bold text-muted uppercase tracking-wide mb-2">{title}</h2>
      {children}
    </section>
  )
}

export function ConsultationReadOnly({ consultation, patient, exams, prescriptions }: Props) {
  const chat = (consultation.chat_history ?? []) as ChatMessage[]
  const anamnesis = (consultation.anamnesis ?? {}) as Record<string, string>
  const physicalExam = (consultation.physical_exam ?? {}) as Record<string, unknown>
  const reasoning = consultation.clinical_reasoning?.trim() ?? ''
  const ab4 = (consultation.ab4_score ?? null) as Ab4 | null
  const minScore = ab4
    ? Math.min(...[ab4.a1, ab4.a2, ab4.a3, ab4.a4].filter((n): n is number => typeof n === 'number'))
    : null
  const communication = (consultation.communication_score ?? null) as Communication | null
  const minComm = communication ? Math.min(communication.c1, communication.c2, communication.c3) : null

  const peEntries = Object.entries(PE_LABELS)
    .map(([k, label]) => [label, physicalExam[k]] as const)
    .filter(([, v]) => typeof v === 'string' && (v as string).trim())
  const extraSystems =
    physicalExam.sistemas_adicionais && typeof physicalExam.sistemas_adicionais === 'object' && !Array.isArray(physicalExam.sistemas_adicionais)
      ? (physicalExam.sistemas_adicionais as Record<string, string>)
      : {}

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link href={patientDetailRoute(patient.id)} className="text-muted hover:text-ink text-lg leading-none">←</Link>
          <h1 className="font-display text-xl font-bold text-ink">{patient.name}</h1>
          <span className="text-xs bg-surface-2 border border-border text-muted px-2 py-0.5 rounded-full">Modo leitura</span>
        </div>
        <p className="text-sm text-muted mb-6 pl-7">
          Consulta finalizada{consultation.finished_at ? ` em ${new Date(consultation.finished_at).toLocaleDateString('pt-BR')}` : ''}
          {' · '}{patient.specialty} · {patient.difficulty}
        </p>

        {/* AB4 */}
        {ab4 && (
          <Section title="Raciocínio clínico">
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm font-semibold text-ink">Geral</span>
                <span className="text-2xl font-bold text-ink">{ab4.overall.toFixed(1)}<span className="text-sm text-muted">/10</span></span>
              </div>
              {ab4.stage === 1 && (
                <p className="text-xs text-muted mb-3">
                  Primeira consulta: avaliamos a abertura do raciocínio. O diferencial e o fechamento entram na próxima consulta, com os resultados dos exames.
                </p>
              )}
              <div className="space-y-2.5 mb-4">
                {AB4_AXES.map(ax => {
                  const score = ab4[ax.key]
                  const pending = score === null
                  const weak = !pending && score === minScore
                  return (
                    <div key={ax.key} className="flex items-center gap-3">
                      <span className={`w-24 shrink-0 text-xs font-medium ${pending ? 'text-muted/50' : 'text-ink'}`}>{ax.label}</span>
                      <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                        {!pending && <div className={`h-full rounded-full ${weak ? 'bg-warning' : 'bg-success'}`} style={{ width: `${score * 10}%` }} />}
                      </div>
                      {pending
                        ? <span className="text-[10px] text-muted shrink-0">próxima consulta</span>
                        : <span className={`w-5 text-right text-sm font-semibold ${weak ? 'text-warning' : 'text-ink'}`}>{score}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="bg-surface-2 border border-border rounded-lg p-3">
                <p className="text-xs font-semibold text-muted mb-1">Recomendação</p>
                <p className="text-sm text-ink">{ab4.recommendation}</p>
              </div>
            </div>
          </Section>
        )}

        {communication && (
          <Section title="Comunicação">
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-sm font-semibold text-ink">Diálogo médico-paciente</span>
                <span className="text-2xl font-bold text-ink">{communication.overall.toFixed(1)}<span className="text-sm text-muted">/10</span></span>
              </div>
              <div className="space-y-2.5 mb-3">
                {COMM_AXES.map(ax => {
                  const score = communication[ax.key]
                  const weak = score === minComm
                  return (
                    <div key={ax.key} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs font-medium text-ink">{ax.label}</span>
                      <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${weak ? 'bg-warning' : 'bg-chart-2'}`} style={{ width: `${score * 10}%` }} />
                      </div>
                      <span className={`w-5 text-right text-sm font-semibold ${weak ? 'text-warning' : 'text-ink'}`}>{score}</span>
                    </div>
                  )
                })}
              </div>
              <div className="bg-surface-2 border border-border rounded-lg p-3">
                <p className="text-xs font-semibold text-muted mb-1">Recomendação</p>
                <p className="text-sm text-ink">{communication.recommendation}</p>
              </div>
            </div>
          </Section>
        )}

        {/* Pensamento clínico */}
        <Section title="Pensamento clínico">
          <div className="bg-surface border border-border rounded-lg p-4">
            {reasoning
              ? <p className="text-sm text-ink whitespace-pre-wrap">{reasoning}</p>
              : <p className="text-sm text-muted italic">Não registrado nesta consulta</p>}
          </div>
        </Section>

        {/* Chat */}
        <Section title="Conversa com o paciente">
          <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            {chat.length === 0
              ? <p className="text-sm text-muted italic">Sem mensagens.</p>
              : chat.map((m, i) => (
                  <div key={i} className={m.role === 'student' ? 'text-right' : 'text-left'}>
                    <span className={`inline-block max-w-[80%] text-sm px-3 py-2 rounded-2xl whitespace-pre-wrap ${m.role === 'student' ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink'}`}>
                      {m.content}
                    </span>
                  </div>
                ))}
          </div>
        </Section>

        {/* Anamnese */}
        <Section title="Anamnese">
          <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            {Object.entries(ANAMNESIS_LABELS).map(([k, label]) => (
              <div key={k}>
                <p className="text-xs font-semibold text-muted mb-1">{label}</p>
                <p className="text-sm text-ink">{anamnesis[k]?.trim() || <span className="text-muted/50 italic">—</span>}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Exame físico */}
        <Section title="Exame físico">
          <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            {peEntries.length === 0 && Object.keys(extraSystems).length === 0
              ? <p className="text-sm text-muted italic">Nenhum exame físico registrado.</p>
              : (
                <>
                  {peEntries.map(([label, v]) => (
                    <div key={label}>
                      <p className="text-xs font-semibold text-muted mb-1">{label}</p>
                      <p className="text-sm text-ink whitespace-pre-wrap">{v as string}</p>
                    </div>
                  ))}
                  {Object.entries(extraSystems).map(([label, v]) => (
                    <div key={label}>
                      <p className="text-xs font-semibold text-muted mb-1">{label}</p>
                      <p className="text-sm text-ink whitespace-pre-wrap">{v}</p>
                    </div>
                  ))}
                </>
              )}
          </div>
        </Section>

        {/* Exames */}
        <Section title="Exames solicitados">
          <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            {exams.length === 0
              ? <p className="text-sm text-muted italic">Nenhum exame solicitado.</p>
              : exams.map((e, i) => (
                  <div key={i} className="border-b border-border last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-ink">{e.exam_name}</p>
                      <span className="text-[10px] uppercase tracking-wide text-muted">{e.status}</span>
                    </div>
                    {e.justification?.trim() && <p className="text-xs text-muted mt-0.5">Justificativa: {e.justification.trim()}</p>}
                    {e.result?.trim() && <p className="text-sm text-ink mt-1 whitespace-pre-wrap">{cleanExamResult(e.result)}</p>}
                  </div>
                ))}
          </div>
        </Section>

        {/* Prescrições */}
        <Section title="Conduta">
          <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            {prescriptions.length === 0
              ? <p className="text-sm text-muted italic">Nenhuma prescrição registrada.</p>
              : prescriptions.map(rx => {
                  const adq = rx.adequacy ? ADEQUACY_LABEL[rx.adequacy] : null
                  return (
                    <div key={rx.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-ink">
                          {rx.kind && rx.kind !== 'medicamento' && <span className="text-muted font-normal">[{rx.kind}] </span>}
                          {rx.drug_name}
                          {rx.status === 'suspended' && <span className="text-muted font-normal"> (suspenso)</span>}
                        </p>
                        {adq && <span className={`text-[10px] uppercase tracking-wide font-semibold ${adq.cls}`}>{adq.text}</span>}
                      </div>
                      <p className="text-xs text-muted mt-0.5">{rx.posology}</p>
                      {rx.ai_feedback?.trim() && <p className="text-xs text-muted mt-1">{rx.ai_feedback.trim()}</p>}
                    </div>
                  )
                })}
          </div>
        </Section>
      </div>
    </div>
  )
}
