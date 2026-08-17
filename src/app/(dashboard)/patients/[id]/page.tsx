import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_ROUTE, consultationRoute } from '@/lib/routes'
import { BondBar } from '@/components/ui/BondBar'
import { StartConsultationButton } from './StartConsultationButton'
import { RevealDiagnosisButton } from './RevealDiagnosisButton'
import Link from 'next/link'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(LOGIN_ROUTE)

  const { id } = await params

  const [patientResult, consultationsResult] = await Promise.all([
    supabase.from('patients').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase
      .from('consultations')
      .select('id, status, finished_at, clinical_reasoning')
      .eq('patient_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  if (patientResult.error || !patientResult.data) notFound()

  const patient = patientResult.data
  const consultations = consultationsResult.data ?? []
  const ongoing = consultations.find(c => c.status === 'ongoing')
  const finished = consultations.filter(c => c.status === 'finished')

  // Exam count — separate defensive query, defaults to 0 on any failure
  let approvedExamCount = 0
  const { data: approvedExams } = await supabase
    .from('exam_requests')
    .select('id')
    .eq('patient_id', id)
    .eq('user_id', user.id)
    .eq('status', 'approved')
  approvedExamCount = approvedExams?.length ?? 0

  const finishedCount = finished.length
  const revealEligible =
    patient.diagnosis_status === 'none' &&
    finishedCount >= 2 &&
    approvedExamCount >= 1

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-ink">{patient.name}</h1>
        <p className="text-sm text-muted">
          {patient.age} anos · {patient.gender === 'M' ? 'Masculino' : 'Feminino'} · {patient.specialty}
        </p>
      </div>

      <div className="mb-6">
        <p className="text-sm font-medium text-muted mb-1">Vínculo</p>
        <BondBar level={patient.bond_level} />
      </div>

      {/* Diagnosis status */}
      {patient.diagnosis_status === 'achieved' && (
        <div className="mb-4 bg-success/10 border border-success/30 rounded-lg p-4">
          <p className="text-xs font-semibold text-success uppercase tracking-wide mb-1">✓ Diagnóstico alcançado</p>
          <p className="text-sm text-ink font-medium">{patient.diagnosis ?? patient.true_diagnosis}</p>
        </div>
      )}

      {patient.diagnosis_status === 'revealed' && (
        <div className="mb-4 bg-warning/10 border border-warning/30 rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-warning uppercase tracking-wide">Diagnóstico revelado</p>
          <p className="text-sm text-ink font-medium">{patient.true_diagnosis}</p>
        </div>
      )}

      {patient.diagnosis_status === 'none' && (
        <div className="mb-4">
          {revealEligible ? (
            <>
              <RevealDiagnosisButton patientId={patient.id} />
              <p className="text-xs text-muted mt-1">Ao concluir, avaliamos se seu raciocínio bateu com o diagnóstico. Não afeta reputação nem scores.</p>
            </>
          ) : (
            <div className="border border-border rounded-md px-4 py-2.5 bg-surface-2">
              <p className="text-sm text-muted">
                Concluir diagnóstico disponível após{' '}
                {finishedCount < 2 && <span className="text-ink font-medium">2 consultas finalizadas</span>}
                {finishedCount < 2 && approvedExamCount < 1 && ' e '}
                {approvedExamCount < 1 && <span className="text-ink font-medium">1 exame aprovado</span>}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {finishedCount}/2 consultas · {approvedExamCount}/1 exame aprovado
              </p>
            </div>
          )}
        </div>
      )}

      {ongoing ? (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-ink">Consulta em andamento</p>
          <Link href={consultationRoute(ongoing.id)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink shadow-[var(--shadow-glow-primary)] transition-colors hover:bg-primary-hover">
            Continuar consulta
          </Link>
        </div>
      ) : (
        <div className="mb-6">
          <StartConsultationButton patientId={patient.id} />
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink mb-3">Consultas anteriores</h2>
        {finished.length === 0 ? (
          <p className="text-muted text-sm">Nenhuma consulta realizada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {finished.map(c => (
              <li key={c.id}>
                <Link
                  href={consultationRoute(c.id)}
                  className="block border border-border rounded-lg p-3 bg-surface hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide">Pensamento clínico</p>
                    <span className="text-xs text-primary">Abrir →</span>
                  </div>
                  {c.clinical_reasoning?.trim() ? (
                    <p className="text-sm text-ink whitespace-pre-wrap line-clamp-4">
                      {c.clinical_reasoning.trim()}
                    </p>
                  ) : (
                    <p className="text-sm text-muted italic">Não registrado nesta consulta</p>
                  )}
                  <p className="text-xs text-muted mt-1">
                    {c.finished_at
                      ? new Date(c.finished_at).toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
