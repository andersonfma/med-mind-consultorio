import { type NextRequest } from 'next/server'
import { type SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyUnsubToken } from '@/lib/email/unsubscribe'

export const dynamic = 'force-dynamic'

function page(msg: string): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Med Mind</title></head>
<body style="margin:0;background:#EEF2F4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0A0F14;">
<div style="max-width:480px;margin:60px auto;padding:0 16px;text-align:center;">
  <div style="font-size:24px;font-weight:700;margin-bottom:20px;">Med<span style="color:#0E7C86">Mind</span></div>
  <div style="background:#fff;border:1px solid #E1E8EC;border-radius:14px;padding:28px;font-size:15px;line-height:1.6;">${msg}</div>
</div></body></html>`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

async function optOut(token: string): Promise<boolean> {
  const userId = verifyUnsubToken(token)
  if (!userId) return false
  const admin = createAdminClient() as unknown as SupabaseClient
  await admin.from('profiles').update({ email_optout: true } as never).eq('id', userId)
  return true
}

export async function GET(req: NextRequest) {
  const ok = await optOut(req.nextUrl.searchParams.get('token') ?? '')
  return page(ok
    ? 'Pronto! Você não receberá mais emails de novidades do Med Mind. 👍'
    : 'Link inválido ou expirado. Se quiser, ajuste suas preferências dentro do app.')
}

// List-Unsubscribe-Post (descadastro em 1 clique pelo cliente de email).
export async function POST(req: NextRequest) {
  const ok = await optOut(req.nextUrl.searchParams.get('token') ?? '')
  return new Response(ok ? 'ok' : 'invalid', { status: ok ? 200 : 400 })
}
