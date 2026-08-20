'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ConsultationChat } from './ConsultationChat'
import { AnamnesisPanel } from './AnamnesisPanel'
import { ClinicalReasoningField } from './ClinicalReasoningField'
import { FinishModal } from './FinishModal'
import { PhysicalExamPanel } from './PhysicalExamPanel'
import { ExamRequestPanel } from './ExamRequestPanel'
import { PrescriptionPanel } from './PrescriptionPanel'
import type { ChatMessage } from '@/lib/consultations/prompts'
import type { Specialty } from '@/lib/patients/specialties'
import type { Anamnesis, PhysicalExam } from '@/lib/consultations/parse'
import type { Patient, Consultation } from '@/types/domain'
import { patientDetailRoute } from '@/lib/routes'

type Props = {
  consultation: Consultation
  patient: Patient
  previousExamResults: Array<{ exam_name: string; result: string | null }>
  activeMedications?: Array<{ drug_name: string; posology: string }>
}

type RecordTab = 'anamnese' | 'exame' | 'exames' | 'conduta' | 'raciocinio'
const TABS: { key: RecordTab; label: string; short: string }[] = [
  { key: 'anamnese', label: 'Anamnese', short: 'Anamnese' },
  { key: 'exame', label: 'Exame Físico', short: 'Ex. Físico' },
  { key: 'exames', label: 'Exames', short: 'Exames' },
  { key: 'conduta', label: 'Conduta', short: 'Conduta' },
  { key: 'raciocinio', label: 'Raciocínio', short: 'Racioc.' },
]

export function ConsultationClient({ consultation, patient, previousExamResults, activeMedications = [] }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    (consultation.chat_history as ChatMessage[]) ?? []
  )
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [preflightOpen, setPreflightOpen] = useState(false)
  const [clinicalReasoning, setClinicalReasoning] = useState(consultation.clinical_reasoning ?? '')

  // Navegação: aba do prontuário (desktop e mobile) + se o mobile está no chat.
  const [recordTab, setRecordTab] = useState<RecordTab>('anamnese')
  const [mobileShowChat, setMobileShowChat] = useState(true)

  // Status por seção (para os indicadores e o checklist).
  const [anamneseHas, setAnamneseHas] = useState(false)
  const [exameHas, setExameHas] = useState(false)
  const [examesCount, setExamesCount] = useState(0)
  const [condutaCount, setCondutaCount] = useState(0)
  const onAnamnese = useCallback((v: boolean) => setAnamneseHas(v), [])
  const onExame = useCallback((v: boolean) => setExameHas(v), [])
  const onExames = useCallback((c: number) => setExamesCount(c), [])
  const onConduta = useCallback((c: number) => setCondutaCount(c), [])

  // Mensagens novas do paciente enquanto o aluno está fora do chat (mobile).
  const [seenCount, setSeenCount] = useState(messages.length)
  useEffect(() => {
    if (mobileShowChat) setSeenCount(messages.length)
  }, [mobileShowChat, messages.length])
  const unread = mobileShowChat ? 0 : Math.max(0, messages.length - seenCount)

  const diagnosisClosed =
    patient.diagnosis_status === 'achieved' || patient.diagnosis_status === 'revealed'
  const [reasoningOpen, setReasoningOpen] = useState(
    !diagnosisClosed || !!consultation.clinical_reasoning?.trim()
  )
  const reasoningHas = clinicalReasoning.trim().length > 0

  const initialAnamnesis: Anamnesis = {
    hda:      ((consultation.anamnesis as Record<string, string>)?.hda)      ?? '',
    hpp:      ((consultation.anamnesis as Record<string, string>)?.hpp)      ?? '',
    ad:       ((consultation.anamnesis as Record<string, string>)?.ad)       ?? '',
    social:   ((consultation.anamnesis as Record<string, string>)?.social)   ?? '',
    familiar: ((consultation.anamnesis as Record<string, string>)?.familiar) ?? '',
  }

  const rawExam = (consultation.physical_exam ?? {}) as Record<string, unknown>
  const initialPhysicalExam: PhysicalExam = {
    antropometria:           typeof rawExam.antropometria === 'string'           ? rawExam.antropometria           : '',
    inspecao_geral:          typeof rawExam.inspecao_geral === 'string'          ? rawExam.inspecao_geral          : '',
    sinais_vitais:           typeof rawExam.sinais_vitais === 'string'           ? rawExam.sinais_vitais           : '',
    aparelho_respiratorio:   typeof rawExam.aparelho_respiratorio === 'string'   ? rawExam.aparelho_respiratorio   : '',
    aparelho_cardiovascular: typeof rawExam.aparelho_cardiovascular === 'string' ? rawExam.aparelho_cardiovascular : '',
    abdome:                  typeof rawExam.abdome === 'string'                  ? rawExam.abdome                  : '',
    membros_inferiores:      typeof rawExam.membros_inferiores === 'string'      ? rawExam.membros_inferiores      : '',
    sistemas_adicionais:     (rawExam.sistemas_adicionais && typeof rawExam.sistemas_adicionais === 'object' && !Array.isArray(rawExam.sistemas_adicionais))
                               ? rawExam.sistemas_adicionais as Record<string, string>
                               : {},
  }

  const touched: Record<RecordTab, boolean> = {
    anamnese: anamneseHas,
    exame: exameHas,
    exames: examesCount > 0,
    conduta: condutaCount > 0,
    raciocinio: reasoningHas,
  }
  const countFor: Partial<Record<RecordTab, number>> = { exames: examesCount, conduta: condutaCount }

  // Seções não registradas (o raciocínio só entra se ainda for esperado).
  const empties = TABS.filter((t) => {
    if (t.key === 'raciocinio' && diagnosisClosed) return false
    return !touched[t.key]
  })

  function goToTab(tab: RecordTab) {
    setRecordTab(tab)
    setMobileShowChat(false)
  }

  function handleFinishClick() {
    if (empties.length > 0) setPreflightOpen(true)
    else setShowFinishModal(true)
  }

  // Indicador em cada aba: badge de contagem (exames/conduta) ou pontinho quando preenchido.
  function Indicator({ tab }: { tab: RecordTab }) {
    const c = countFor[tab]
    if (typeof c === 'number' && c > 0) {
      return <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">{c}</span>
    }
    if (touched[tab]) return <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
    return null
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href={patientDetailRoute(patient.id)} className="text-muted hover:text-ink text-lg leading-none shrink-0">←</Link>
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-ink text-sm leading-tight truncate">{patient.name}</h1>
            <p className="text-xs text-muted truncate">
              {patient.age} anos · {patient.specialty}<span className="hidden sm:inline"> · {patient.difficulty}</span>
            </p>
          </div>
        </div>
        <button
          onClick={handleFinishClick}
          className="shrink-0 rounded-md bg-primary px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-primary-ink shadow-[var(--shadow-glow-primary)] transition-colors hover:bg-primary-hover"
        >
          Finalizar<span className="hidden sm:inline"> consulta</span>
        </button>
      </div>

      {/* Corpo: mobile = um painel por vez; md+ = dois painéis */}
      <div className="flex-1 min-h-0 flex md:grid md:grid-cols-[minmax(340px,400px)_1fr]">
        {/* CHAT */}
        <section className={`${mobileShowChat ? 'flex' : 'hidden'} md:flex flex-col min-h-0 flex-1 md:flex-none md:border-r border-border bg-surface/30`}>
          <ConsultationChat
            consultationId={consultation.id}
            initialMessages={messages}
            onMessagesUpdate={setMessages}
            patientGender={patient.gender}
          />
        </section>

        {/* PRONTUÁRIO (abas) */}
        <section className={`${!mobileShowChat ? 'flex' : 'hidden'} md:flex flex-col min-h-0 flex-1`}>
          {/* Abas — desktop (pills claramente clicáveis) */}
          <div role="tablist" aria-label="Seções do prontuário" className="hidden md:flex items-center gap-1 border-b border-border bg-surface px-3 py-2 shrink-0 overflow-x-auto">
            {TABS.map((t) => {
              const active = recordTab === t.key
              return (
                <button
                  key={t.key}
                  role="tab"
                  onClick={() => setRecordTab(t.key)}
                  aria-selected={active}
                  className={`inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                    active ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-surface-2 hover:text-ink'
                  }`}
                >
                  {t.label}
                  <Indicator tab={t.key} />
                </button>
              )
            })}
          </div>

          {/* Conteúdo do prontuário — todos montados, só o ativo visível (preserva estado) */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-3xl px-1 sm:px-3 py-1">
              <div className={recordTab === 'anamnese' ? '' : 'hidden'}>
                <AnamnesisPanel consultationId={consultation.id} initialAnamnesis={initialAnamnesis} onStatus={onAnamnese} />
              </div>
              <div className={recordTab === 'exame' ? '' : 'hidden'}>
                <PhysicalExamPanel consultationId={consultation.id} initialExam={initialPhysicalExam} onStatus={onExame} />
              </div>
              <div className={recordTab === 'exames' ? '' : 'hidden'}>
                <ExamRequestPanel consultationId={consultation.id} previousExamResults={previousExamResults} onStatus={onExames} />
              </div>
              <div className={recordTab === 'conduta' ? '' : 'hidden'}>
                <PrescriptionPanel consultationId={consultation.id} specialty={patient.specialty as Specialty} activeMedications={activeMedications} onStatus={onConduta} />
              </div>
              <div className={recordTab === 'raciocinio' ? '' : 'hidden'}>
                {diagnosisClosed && !reasoningOpen ? (
                  <div className="p-4">
                    <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2">
                      <p className="text-sm text-muted">
                        Diagnóstico já fechado — esta é uma consulta de acompanhamento. O raciocínio
                        diagnóstico (AB4) já foi avaliado no arco anterior.
                      </p>
                      <button onClick={() => setReasoningOpen(true)} className="text-sm font-medium text-primary hover:underline">
                        + Registrar novo raciocínio
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="min-h-[240px]">
                      <ClinicalReasoningField consultationId={consultation.id} value={clinicalReasoning} onChange={setClinicalReasoning} />
                    </div>
                    {diagnosisClosed && (
                      <p className="mt-1 text-xs text-muted">Nota de acompanhamento — não recalcula o AB4.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Abas — mobile (barra inferior): Chat + prontuário */}
      <nav role="tablist" aria-label="Seções" className="md:hidden shrink-0 border-t border-border bg-surface flex items-stretch">
        <button
          role="tab"
          aria-selected={mobileShowChat}
          onClick={() => setMobileShowChat(true)}
          className={`relative flex-1 min-w-[54px] px-1 py-2.5 text-[11px] font-semibold border-t-2 transition-colors ${
            mobileShowChat ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted'
          }`}
        >
          Chat
          {unread > 0 && <span className="absolute top-1.5 left-1/2 ml-3 h-2 w-2 rounded-full bg-secondary" />}
        </button>
        {TABS.map((t) => {
          const active = !mobileShowChat && recordTab === t.key
          const c = countFor[t.key]
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => goToTab(t.key)}
              className={`relative flex-1 min-w-[54px] px-1 py-2.5 text-[11px] font-semibold whitespace-nowrap border-t-2 transition-colors ${
                active ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted'
              }`}
            >
              {t.short}
              {typeof c === 'number' && c > 0
                ? <span className="ml-1 inline-flex items-center rounded-full bg-primary/15 px-1 text-[9px] font-semibold text-primary">{c}</span>
                : touched[t.key] && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}
            </button>
          )
        })}
      </nav>

      {/* Checklist antes de finalizar */}
      {preflightOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-[var(--shadow-card)]">
            <h2 className="font-display text-lg font-bold text-ink mb-2">Finalizar consulta?</h2>
            <p className="text-sm text-muted mb-3">Você ainda não registrou:</p>
            <ul className="text-sm text-ink mb-4 space-y-1.5">
              {empties.map((e) => (
                <li key={e.key} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" />{e.label}
                </li>
              ))}
            </ul>
            {empties.some((e) => e.key === 'raciocinio') && (
              <p className="text-xs text-muted mb-4">O raciocínio clínico conta na sua pontuação (AB4).</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setPreflightOpen(false); goToTab(empties[0].key) }}
                className="flex-1 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface hover:border-border-strong"
              >
                Revisar
              </button>
              <button
                onClick={() => { setPreflightOpen(false); setShowFinishModal(true) }}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink shadow-[var(--shadow-glow-primary)] transition-colors hover:bg-primary-hover"
              >
                Finalizar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      {showFinishModal && (
        <FinishModal
          consultationId={consultation.id}
          clinicalReasoning={clinicalReasoning}
          onClose={() => setShowFinishModal(false)}
        />
      )}
    </div>
  )
}
