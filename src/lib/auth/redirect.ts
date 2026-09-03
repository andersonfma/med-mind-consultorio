import { LOGIN_ROUTE, DASHBOARD_ROUTE } from '../routes'

const AUTH_ROUTES = ['/login', '/register', '/reset-password']

// Rotas públicas de metadata/arquivos gerados pelo Next (favicon, imagem de
// compartilhamento, robots etc.). Precisam ser acessíveis SEM login — senão
// scrapers de link (WhatsApp, redes) recebem um redirect para /login e o
// preview quebra.
const PUBLIC_FILE_ROUTES = [
  '/icon',            // icon.svg, icon.png…
  '/apple-icon',
  '/opengraph-image',
  '/twitter-image',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest',
  '/landing',
]

export function getRedirectPath(
  pathname: string,
  isAuthenticated: boolean
): string | null {
  if (PUBLIC_FILE_ROUTES.some((route) => pathname.startsWith(route))) return null

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  if (!isAuthenticated && !isAuthRoute) return LOGIN_ROUTE
  if (isAuthenticated && isAuthRoute) return DASHBOARD_ROUTE
  return null
}
