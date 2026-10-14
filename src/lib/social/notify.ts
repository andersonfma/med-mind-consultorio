import 'server-only'
import { type SupabaseClient } from '@supabase/supabase-js'

type NotifType = 'like' | 'comment' | 'follow' | 'doubt_answer'

/**
 * Grava uma notificação para `userId` (destinatário). Best-effort: nunca lança — uma falha
 * aqui não pode quebrar a ação principal (curtir/comentar/seguir). Não notifica a si mesmo.
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
  } catch { /* best-effort */ }
}
