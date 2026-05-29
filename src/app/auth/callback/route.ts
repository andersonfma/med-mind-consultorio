import { createClient } from '@/lib/supabase/server'
import { getSafeNext } from '@/lib/auth/safe-next'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  // Behind a reverse proxy (Easypanel/Docker), request.url uses the internal
  // 0.0.0.0 address. Use forwarded headers to build the correct public origin.
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${getSafeNext(next)}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
}
