import { DASHBOARD_ROUTE } from '../routes'

export function getSafeNext(next: string | null): string {
  if (
    next &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\')
  ) {
    return next
  }
  return DASHBOARD_ROUTE
}
