'use client'
import { useState } from 'react'
import { ConsultationChat } from './ConsultationChat'
import { AnamnesisPanel } from './AnamnesisPanel'
import { ClinicalReasoningField } from './ClinicalReasoningField'
import { FinishModal } from './FinishModal'
import type { ChatMessage } from '@/lib/consultations/prompts'
import type { Anamnesis } from '@/lib/consultations/parse'
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
        {/* Chat — 55% */}
        <div className="w-[55%] border-r flex flex-col">
          <ConsultationChat
            consultationId={consultation.id}
            initialMessages={messages}
            onMessagesUpdate={setMessages}
          />
        </div>

        {/* Right panel — 45% */}
        <div className="w-[45%] flex flex-col overflow-y-auto">
          <div className="border-b">
            <p className="px-4 pt-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">
              Anamnese
            </p>
            <AnamnesisPanel
              consultationId={consultation.id}
              initialAnamnesis={initialAnamnesis}
            />
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
