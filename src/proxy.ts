import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getRedirectPath } from '@/lib/auth/redirect'

export async function proxy(request: NextRequest) {
  // Domínio de marketing (raiz medmindedu.com.br): site estático multipágina,
  // público e SEM auth. O app continua em app.medmindedu.com.br.
  const host = request.headers.get('host') ?? ''
  const isMarketing = host === 'medmindedu.com.br' || host === 'www.medmindedu.com.br'
  if (isMarketing) {
    const p = request.nextUrl.pathname
    const SITE: Record<string, string> = {
      '/': '/landing.html',
      '': '/landing.html',
      '/simulador': '/site/simulador.html',
      '/comunidade': '/site/comunidade.html',
      '/simulados': '/site/simulados.html',
      '/faculdades': '/site/faculdades.html',
    }
    if (SITE[p]) return NextResponse.rewrite(new URL(SITE[p], request.url))
    // Qualquer outro caminho no domínio de marketing (site.css, imagens, .html
    // diretos) é servido estaticamente, sem passar pela lógica de auth do app.
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Usar getUser() — valida sessão no servidor, nunca getSession()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // API routes are never redirected — the route handler returns 401 itself.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  const redirectPath = getRedirectPath(request.nextUrl.pathname, !!user)

  if (redirectPath) {
    const url = request.nextUrl.clone()
    url.pathname = redirectPath
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((c) =>
      redirect.cookies.set(c)
    )
    return redirect
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/callback).*)',
  ],
}
