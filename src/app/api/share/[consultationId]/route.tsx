import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const WIDTH = 1200
const HEIGHT = 630

// Símbolo da marca (só formas — rasteriza sem depender de fonte).
const MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
  '<rect width="32" height="32" rx="8" fill="#22E0E6"/>' +
  '<g stroke="#04191A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none">' +
  '<line x1="7.5" y1="8.5" x2="24.5" y2="8.5"/><line x1="9.3" y1="11.2" x2="22.7" y2="11.2"/>' +
  '<line x1="10.8" y1="11.2" x2="10.8" y2="22.6"/><line x1="21.2" y1="11.2" x2="21.2" y2="22.6"/>' +
  '<path d="M12.2 11.2 L16 18.8 L19.8 11.2"/></g>' +
  '<rect x="9.6" y="22.6" width="2.4" height="2.4" rx="0.4" fill="#04191A"/>' +
  '<rect x="20" y="22.6" width="2.4" height="2.4" rx="0.4" fill="#04191A"/></svg>'

async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&text=${encodeURIComponent(text)}`
    const css = await (await fetch(url)).text()
    const m = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)
    if (!m) return null
    return await (await fetch(m[1])).arrayBuffer()
  } catch {
    return null
  }
}

const DIFF_LABEL: Record<string, string> = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' }

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ consultationId: string }> },
) {
  const { consultationId } = await params
  const admin = createAdminClient()

  const { data: consult } = await admin
    .from('consultations')
    .select('patient_id, status, points, ab4_score')
    .eq('id', consultationId)
    .single()

  const c = consult as
    | { patient_id?: string; status?: string; points?: number; ab4_score?: { overall?: number } | null }
    | null

  if (!c || c.status !== 'finished') {
    return new Response('Not found', { status: 404 })
  }

  const { data: patient } = await admin
    .from('patients')
    .select('specialty, difficulty, true_diagnosis, diagnosis_status')
    .eq('id', c.patient_id)
    .single()

  const p = patient as
    | { specialty?: string; difficulty?: string; true_diagnosis?: string | null; diagnosis_status?: string }
    | null

  const revealed = p?.diagnosis_status === 'revealed' || p?.diagnosis_status === 'achieved'
  const headline = (revealed && p?.true_diagnosis?.trim()) ? p.true_diagnosis.trim() : (p?.specialty ?? 'Consulta clínica')
  const eyebrow = revealed ? 'Caso concluído' : 'Consulta concluída'
  const reasoning = typeof c.ab4_score?.overall === 'number' ? Math.round(c.ab4_score.overall) : null
  const difficulty = DIFF_LABEL[p?.difficulty ?? ''] ?? '—'
  const points = c.points ?? 0

  const fontText =
    'MedMind' + headline + eyebrow + 'Raciocínio Dificuldade XP Pontos ' +
    difficulty + points + (reasoning ?? '') + '/10'
  const font = await loadFont(fontText)
  const ff = font ? 'Grotesk' : undefined
  const markSrc = `data:image/svg+xml;base64,${Buffer.from(MARK).toString('base64')}`

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: ff, fontSize: 24, color: '#93A4B2', letterSpacing: 1 }}>{label}</span>
      <span style={{ fontFamily: ff, fontSize: 60, fontWeight: 700, color: '#E9EFF3' }}>{value}</span>
    </div>
  )

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#0A0F14',
          backgroundImage: 'radial-gradient(900px 400px at 85% -10%, rgba(34,224,230,0.16), transparent)',
        }}
      >
        {/* Topo: marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img width={76} height={76} src={markSrc} alt="" style={{ borderRadius: 18 }} />
          {font && (
            <div style={{ display: 'flex', fontFamily: ff, fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
              <span style={{ color: '#E9EFF3' }}>Med</span>
              <span style={{ color: '#22E0E6' }}>Mind</span>
            </div>
          )}
        </div>

        {/* Centro: título do caso */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {font && (
            <span style={{ fontFamily: ff, fontSize: 26, color: '#22E0E6', letterSpacing: 2, textTransform: 'uppercase' }}>
              {eyebrow}
            </span>
          )}
          {font && (
            <span style={{ fontFamily: ff, fontSize: 82, fontWeight: 700, color: '#E9EFF3', lineHeight: 1.05, letterSpacing: -2 }}>
              {headline}
            </span>
          )}
        </div>

        {/* Base: métricas */}
        <div style={{ display: 'flex', gap: 80 }}>
          {reasoning !== null && <Stat label="Raciocínio" value={`${reasoning}/10`} />}
          <Stat label="Dificuldade" value={difficulty} />
          <Stat label="Pontos" value={`${points} XP`} />
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: font ? [{ name: 'Grotesk', data: font, weight: 700, style: 'normal' }] : [],
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    },
  )
}
