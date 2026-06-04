import { LOGIN_ROUTE, DASHBOARD_ROUTE } from '../routes'

const AUTH_ROUTES = ['/login', '/register', '/reset-password']

export function getRedirectPath(
  pathname: string,
  isAuthenticated: boolean
): string | null {
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  if (!isAuthenticated && !isAuthRoute) return LOGIN_ROUTE
  if (isAuthenticated && isAuthRoute) return DASHBOARD_ROUTE
  return null
}
