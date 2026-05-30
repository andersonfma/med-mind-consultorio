import { createClient } from '@/lib/supabase/server'
import { getSafeNext } from '@/lib/auth/safe-next'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  // SITE_URL is a server-only runtime env var — no build-time baking needed.
  // Falls back to request origin for local dev (where SITE_URL is not set).
  const origin = process.env.SITE_URL ?? new URL(request.url).origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${getSafeNext(next)}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
}
