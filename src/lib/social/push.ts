import 'server-only'
import webpush from 'web-push'
import { type SupabaseClient } from '@supabase/supabase-js'

let configured = false
function ensure(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@medmindedu.com.br', pub, priv)
    configured = true
  }
  return true
}

/** Envia Web Push para todas as inscrições de `userId`. Best-effort; limpa inscrições mortas. */
export async function sendPush(admin: SupabaseClient, userId: string, payload: { title: string; body: string; url?: string; tag?: string }): Promise<void> {
  try {
    if (!ensure()) return
    const { data } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
    const subs = (data ?? []) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>
    await Promise.all(subs.map(async s => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload))
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
      }
    }))
  } catch { /* best-effort */ }
}
