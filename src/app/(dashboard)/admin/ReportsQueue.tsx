import { createAdminClient } from '@/lib/supabase/admin'
import { displayIdentity } from '@/lib/social/identity'
import type { ProfileSocial } from '@/lib/social/types'
import { postRoute } from '@/lib/routes'
import { ReportActions } from './ReportActions'

/** Fila de denúncias abertas (server component). Lê via service role (reports não tem SELECT p/ authenticated). */
export async function ReportsQueue() {
  const admin = createAdminClient()
  const { data: repRows } = await admin.from('reports').select('id, target_type, target_id, reporter_id, reason, created_at').eq('status', 'open').order('created_at', { ascending: false }).limit(50)
  const reports = (repRows ?? []) as Array<{ id: string; target_type: string; target_id: string; reporter_id: string; reason: string | null; created_at: string }>

  if (reports.length === 0) {
    return <p className="text-sm text-muted">Nenhuma denúncia aberta.</p>
  }

  const postIds = reports.filter(r => r.target_type === 'post').map(r => r.target_id)
  const commentIds = reports.filter(r => r.target_type === 'comment').map(r => r.target_id)
  const reporterIds = [...new Set(reports.map(r => r.reporter_id))]

  const [{ data: posts }, { data: comments }, { data: profs }] = await Promise.all([
    admin.from('posts').select('id, kind, body, author_id, hidden_at').in('id', postIds.length ? postIds : ['_']),
    admin.from('comments').select('id, body, author_id, hidden_at').in('id', commentIds.length ? commentIds : ['_']),
    admin.from('profiles').select('id, identity_mode, handle, display_name, avatar_url, leaderboard_alias, full_name').in('id', reporterIds.length ? reporterIds : ['_']),
  ])
  const postById = new Map((posts as Array<{ id: string; kind: string; body: string | null; author_id: string; hidden_at: string | null }> ?? []).map(p => [p.id, p]))
  const commentById = new Map((comments as Array<{ id: string; body: string | null; author_id: string; hidden_at: string | null }> ?? []).map(c => [c.id, c]))
  const profById = new Map((profs as ProfileSocial[] ?? []).map(p => [p.id, p]))

  return (
    <ul className="space-y-3">
      {reports.map(r => {
        const isPost = r.target_type === 'post'
        const target = isPost ? postById.get(r.target_id) : commentById.get(r.target_id)
        const preview = (target?.body ?? '').trim() || (isPost && (target as { kind?: string })?.kind === 'card' ? '[card de resultado]' : isPost ? `[${(target as { kind?: string })?.kind ?? 'post'}]` : '[comentário]')
        const hidden = !!target?.hidden_at
        const reporter = profById.get(r.reporter_id)
        const reporterName = reporter ? displayIdentity(reporter).name : 'Aluno'
        const postLink = isPost ? r.target_id : null
        return (
          <li key={r.id} className="rounded-lg border border-border bg-surface p-3">
            <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
              <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold uppercase">{isPost ? 'Post' : 'Comentário'}</span>
              <span>denunciado por {reporterName}</span>
              {hidden && <span className="font-semibold text-danger">· já oculto</span>}
            </div>
            <p className="mb-2 line-clamp-3 whitespace-pre-wrap text-sm text-ink">{preview}</p>
            {r.reason && <p className="mb-2 text-xs text-muted">Motivo: {r.reason}</p>}
            <div className="flex items-center justify-between gap-3">
              {postLink
                ? <a href={postRoute(postLink)} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">ver post</a>
                : <span className="text-xs text-muted">comentário em post</span>}
              <ReportActions reportId={r.id} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
