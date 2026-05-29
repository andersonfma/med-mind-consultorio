const AUTH_ROUTES = ['/login', '/register', '/reset-password']

export function getRedirectPath(
  pathname: string,
  isAuthenticated: boolean
): string | null {
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  if (!isAuthenticated && !isAuthRoute) return '/login'
  if (isAuthenticated && isAuthRoute) return '/dashboard'
  return null
}
