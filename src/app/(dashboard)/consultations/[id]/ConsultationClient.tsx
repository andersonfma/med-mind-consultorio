'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ConsultationChat } from './ConsultationChat'
import { AnamnesisPanel } from './AnamnesisPanel'
import { ClinicalReasoningField } from './ClinicalReasoningField'
import { FinishModal } from './FinishModal'
import { PhysicalExamPanel } from './PhysicalExamPanel'
import { ExamRequestPanel } from './ExamRequestPanel'
import type { ChatMessage } from '@/lib/consultations/prompts'
import type { Anamnesis, PhysicalExam } from '@/lib/consultations/parse'
import type { Patient, Consultation } from '@/types/domain'
import { patientDetailRoute } from '@/lib/routes'

type Props = {
  consultation: Consultation
  patient: Patient
  previousExamResults: Array<{ exam_name: string; result: string | null }>
}

export function ConsultationClient({ consultation, patient, previousExamResults }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    (consultation.chat_history as ChatMessage[]) ?? []
  )
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [clinicalReasoning, setClinicalReasoning] = useState(consultation.clinical_reasoning ?? '')

  // Diagnóstico já fechado → consulta de acompanhamento: o arco AB4 terminou.
  // O campo de pensamento clínico fica colapsado; o aluno pode reabri-lo se houver
  // dado novo no seguimento (vira só nota, não recalcula o AB4).
  const diagnosisClosed =
    patient.diagnosis_status === 'achieved' || patient.diagnosis_status === 'revealed'
  const [reasoningOpen, setReasoningOpen] = useState(
    !diagnosisClosed || !!consultation.clinical_reasoning?.trim()
  )

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Link href={patientDetailRoute(patient.id)} className="text-gray-400 hover:text-gray-600 text-sm">
            ←
          </Link>
          <div>
            <h1 className="font-semibold text-gray-900 text-sm leading-tight">{patient.name}</h1>
            <p className="text-xs text-gray-400">{patient.age} anos · {patient.specialty} · {patient.difficulty}</p>
          </div>
        </div>
        <button
          onClick={() => setShowFinishModal(true)}
          className="btn btn--primary text-sm"
        >
          Finalizar consulta
        </button>
      </div>

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Column 1 — Chat + Anamnese (38%) */}
        <div className="w-[38%] border-r flex flex-col">
          {/* Chat — ocupa a parte superior, scrollável */}
          <div className="flex-[3] flex flex-col overflow-hidden border-b">
            <ConsultationChat
              consultationId={consultation.id}
              initialMessages={messages}
              onMessagesUpdate={setMessages}
            />
          </div>
          {/* Anamnese — parte inferior */}
          <div className="flex-[2] flex flex-col overflow-y-auto">
            <p className="px-3 pt-3 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wide shrink-0">Anamnese</p>
            <AnamnesisPanel consultationId={consultation.id} initialAnamnesis={initialAnamnesis} />
          </div>
        </div>

        {/* Column 2 — Exame Físico + Exames (37%) */}
        <div className="w-[37%] border-r flex flex-col overflow-y-auto">
          <div className="border-b">
            <p className="px-3 pt-3 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wide">Exame Físico</p>
            <PhysicalExamPanel consultationId={consultation.id} initialExam={initialPhysicalExam} />
          </div>
          <div>
            <p className="px-3 pt-3 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wide">Exames</p>
            <ExamRequestPanel
              consultationId={consultation.id}
              previousExamResults={previousExamResults}
            />
          </div>
        </div>

        {/* Column 3 — Pensamento Clínico (25%) */}
        <div className="w-[25%] flex flex-col">
          <p className="px-3 pt-3 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wide shrink-0">
            Pensamento Clínico
          </p>
          {diagnosisClosed && !reasoningOpen ? (
            <div className="px-3 pb-3">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
                <p className="text-sm text-gray-500">
                  Diagnóstico já fechado — esta é uma consulta de acompanhamento. O raciocínio
                  diagnóstico (AB4) já foi avaliado no arco anterior.
                </p>
                <button
                  onClick={() => setReasoningOpen(true)}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  + Registrar novo raciocínio
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 px-3 pb-3">
              <ClinicalReasoningField
                consultationId={consultation.id}
                value={clinicalReasoning}
                onChange={setClinicalReasoning}
              />
              {diagnosisClosed && (
                <p className="mt-1 text-xs text-gray-400">
                  Nota de acompanhamento — não recalcula o AB4.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

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
