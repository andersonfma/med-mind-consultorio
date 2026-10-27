import 'server-only'

const RESEND_URL = 'https://api.resend.com/emails'
const FROM = 'MedMind <contato@medmindedu.com.br>'

export type SendResult = { ok: boolean; id?: string; error?: string }

/**
 * Envia um email via Resend. Best-effort. Requer RESEND_API_KEY no ambiente.
 * `listUnsubscribe` adiciona o header List-Unsubscribe (entrega + 1-clique).
 */
export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text?: string
  listUnsubscribe?: string
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'RESEND_API_KEY ausente' }

  const headers: Record<string, string> = {}
  if (params.listUnsubscribe) {
    headers['List-Unsubscribe'] = `<${params.listUnsubscribe}>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: params.to, subject: params.subject, html: params.html, text: params.text, headers }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (j as { message?: string }).message ?? `HTTP ${res.status}` }
    return { ok: true, id: (j as { id?: string }).id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network' }
  }
}
