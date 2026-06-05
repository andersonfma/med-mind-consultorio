'use client'
import { useState } from 'react'
import { ConsultationChat } from './ConsultationChat'
import { AnamnesisPanel } from './AnamnesisPanel'
import { ClinicalReasoningField } from './ClinicalReasoningField'
import { FinishModal } from './FinishModal'
import { PhysicalExamPanel } from './PhysicalExamPanel'
import { ExamRequestPanel } from './ExamRequestPanel'
import type { ChatMessage } from '@/lib/consultations/prompts'
import type { Anamnesis, PhysicalExam } from '@/lib/consultations/parse'
import type { Patient, Consultation } from '@/types/domain'

type Props = {
  consultation: Consultation
  patient: Patient
}

export function ConsultationClient({ consultation, patient }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    (consultation.chat_history as ChatMessage[]) ?? []
  )
  const [showFinishModal, setShowFinishModal] = useState(false)

  const initialAnamnesis: Anamnesis = {
    hda:      ((consultation.anamnesis as Record<string, string>)?.hda)      ?? '',
    hpp:      ((consultation.anamnesis as Record<string, string>)?.hpp)      ?? '',
    ad:       ((consultation.anamnesis as Record<string, string>)?.ad)       ?? '',
    social:   ((consultation.anamnesis as Record<string, string>)?.social)   ?? '',
    familiar: ((consultation.anamnesis as Record<string, string>)?.familiar) ?? '',
  }

  const rawExam = (consultation.physical_exam ?? {}) as Record<string, unknown>
  const initialPhysicalExam: PhysicalExam = {
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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white">
        <div>
          <h1 className="font-semibold text-gray-900">{patient.name}</h1>
          <p className="text-xs text-gray-500">
            {patient.age} anos · {patient.specialty} · {patient.difficulty}
          </p>
        </div>
        <button
          onClick={() => setShowFinishModal(true)}
          className="btn btn--primary text-sm"
        >
          Finalizar consulta
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat — 40% */}
        <div className="w-[40%] border-r flex flex-col">
          <ConsultationChat
            consultationId={consultation.id}
            initialMessages={messages}
            onMessagesUpdate={setMessages}
          />
        </div>

        {/* Right panel — 60% */}
        <div className="w-[60%] flex flex-col overflow-y-auto">
          <div className="border-b">
            <p className="px-4 pt-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">
              Anamnese
            </p>
            <AnamnesisPanel
              consultationId={consultation.id}
              initialAnamnesis={initialAnamnesis}
            />
          </div>
          <div className="border-b">
            <p className="px-4 pt-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">
              Exame Físico
            </p>
            <PhysicalExamPanel
              consultationId={consultation.id}
              initialExam={initialPhysicalExam}
            />
          </div>
          <div className="border-b">
            <p className="px-4 pt-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">
              Exames Solicitados
            </p>
            <ExamRequestPanel consultationId={consultation.id} />
          </div>
          <div className="flex-1 flex flex-col">
            <ClinicalReasoningField
              consultationId={consultation.id}
              initialValue={consultation.clinical_reasoning ?? ''}
            />
          </div>
        </div>
      </div>

      {showFinishModal && (
        <FinishModal
          consultationId={consultation.id}
          onClose={() => setShowFinishModal(false)}
        />
      )}
    </div>
  )
}
