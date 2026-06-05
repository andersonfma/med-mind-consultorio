export type ExamRequest = {
  id: string
  consultation_id: string
  patient_id: string
  user_id: string
  exam_name: string
  justification: string
  attempts: number
  status: 'approved' | 'rejected'
  ai_feedback: string
  result: string | null
  created_at: string
}
