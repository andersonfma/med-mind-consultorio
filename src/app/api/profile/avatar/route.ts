import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { contentType?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const ct = typeof body.contentType === 'string' ? body.contentType : ''
  const ext = EXT[ct]
  if (!ct.startsWith('image/') || !ext) return NextResponse.json({ error: 'Tipo não suportado' }, { status: 415 })

  const admin = createAdminClient()
  const path = `${user.id}.${ext}`
  const bucket = admin.storage.from('avatars')
  const { data, error } = await bucket.createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: 'Falha ao preparar upload' }, { status: 500 })
  const { data: pub } = bucket.getPublicUrl(path)

  await admin.from('profiles').update({ avatar_url: pub.publicUrl } as never).eq('id', user.id)

  return NextResponse.json({ uploadUrl: data.signedUrl, token: data.token, path: data.path, publicUrl: pub.publicUrl }, { status: 200 })
}
