import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { contentType?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const ct = typeof body.contentType === 'string' ? body.contentType : ''
  const ext = EXT[ct]
  if (!ext || !(ct.startsWith('image/') || ct.startsWith('video/'))) return NextResponse.json({ error: 'Tipo não suportado' }, { status: 415 })

  const admin = createAdminClient()
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`
  const bucket = admin.storage.from('post-media')
  const { data, error } = await bucket.createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: 'Falha ao preparar upload' }, { status: 500 })
  const publicUrl = bucket.getPublicUrl(path).data.publicUrl
  return NextResponse.json({ uploadUrl: data.signedUrl, publicUrl }, { status: 200 })
}
