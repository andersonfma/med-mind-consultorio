export function getSafeNext(next: string | null): string {
  if (
    next &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\')
  ) {
    return next
  }
  return '/dashboard'
}
