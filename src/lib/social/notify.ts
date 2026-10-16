import 'server-only'
import { type SupabaseClient } from '@supabase/supabase-js'
import { displayIdentity } from './identity'
import type { ProfileSocial } from './types'
import { sendPush } from './push'

type NotifType = 'like' | 'comment' | 'follow' | 'doubt_answer'

function pushText(type: NotifType, actor: string): { title: string; body: string } {
  switch (type) {
    case 'like': return { title: 'Med Mind', body: `${actor} curtiu seu post` }
    case 'comment': return { title: 'Med Mind', body: `${actor} comentou no seu post` }
    case 'follow': return { title: 'Med Mind', body: `${actor} começou a te seguir` }
    case 'doubt_answer': return { title: 'Med Mind', body: `Você ganhou MedCoin por responder a dúvida de ${actor}` }
  }
}

/**
 * Grava uma notificação para `userId` (destinatário) E dispara Web Push. Best-effort: nunca
 * lança — uma falha aqui não pode quebrar a ação principal. Não notifica a si mesmo.
 */
export async function notify(
  admin: SupabaseClient,
  params: { userId: string; actorId: string; type: NotifType; postId?: string | null },
): Promise<void> {
  try {
    if (!params.userId || params.userId === params.actorId) return
    await admin.from('notifications').insert({
      user_id: params.userId,
      actor_id: params.actorId,
      type: params.type,
      post_id: params.postId ?? null,
    })

    // Web Push (best-effort): resolve o nome do ator e envia.
    const { data: prof } = await admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, leaderboard_alias, full_name').eq('id', params.actorId).maybeSingle()
    const actor = prof ? displayIdentity(prof as ProfileSocial).name : 'Alguém'
    const { title, body } = pushText(params.type, actor)
    const url = params.postId ? `/post/${params.postId}` : '/feed'
    await sendPush(admin, params.userId, { title, body, url, tag: params.type })
  } catch { /* best-effort */ }
}
