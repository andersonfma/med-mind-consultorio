import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Med Mind — Simulador clínico'

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

// Carrega uma fonte do Google (TTF) para o texto. Se falhar, o card é
// renderizado só com a logo — nunca quebra a rota.
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

export default async function Image() {
  const tagline = 'Treine o raciocínio clínico — antes do paciente real'
  const font = await loadFont('MedMind' + tagline)
  const markSrc = `data:image/svg+xml;base64,${Buffer.from(MARK).toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 36,
          background: '#0A0F14',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          width={188}
          height={188}
          src={markSrc}
          alt=""
          style={{ borderRadius: 42, boxShadow: '0 20px 90px -20px rgba(34,224,230,0.6)' }}
        />
        {font && (
          <div style={{ display: 'flex', fontFamily: 'Grotesk', fontSize: 92, fontWeight: 700, letterSpacing: -2 }}>
            <span style={{ color: '#E9EFF3' }}>Med</span>
            <span style={{ color: '#22E0E6' }}>Mind</span>
          </div>
        )}
        {font && (
          <div style={{ display: 'flex', fontFamily: 'Grotesk', fontSize: 33, color: '#93A4B2' }}>{tagline}</div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: 'Grotesk', data: font, weight: 700, style: 'normal' }] : [],
    },
  )
}
