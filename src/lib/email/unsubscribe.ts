import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

// Token de descadastro stateless: base64url(userId).hmac — verificável sem consultar o banco.
// Assinado com CRON_SECRET (server-only). Se um dia rotacionarmos o secret, tokens antigos expiram.
function secret(): string {
  return process.env.CRON_SECRET ?? 'dev-secret'
}

function b64url(s: string): string {
  return Buffer.from(s).toString('base64url')
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function makeUnsubToken(userId: string): string {
  const p = b64url(userId)
  return `${p}.${sign(p)}`
}

export function verifyUnsubToken(token: string): string | null {
  const [p, sig] = (token ?? '').split('.')
  if (!p || !sig) return null
  const expected = sign(p)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    return Buffer.from(p, 'base64url').toString('utf8') || null
  } catch {
    return null
  }
}
