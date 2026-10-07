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
  // upsert: permite trocar a foto depois (sobrescreve o mesmo path)
  const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: true })
  if (error || !data) return NextResponse.json({ error: 'Falha ao preparar upload' }, { status: 500 })
  // versiona a URL pública p/ furar o cache de CDN quando a foto muda (mesmo path)
  const versioned = `${bucket.getPublicUrl(path).data.publicUrl}?v=${Date.now()}`

  await admin.from('profiles').update({ avatar_url: versioned } as never).eq('id', user.id)

  return NextResponse.json({ uploadUrl: data.signedUrl, token: data.token, path: data.path, publicUrl: versioned }, { status: 200 })
}
