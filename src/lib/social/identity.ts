type IdInput = {
  identity_mode: 'real' | 'alias'
  display_name: string | null
  avatar_url: string | null
  leaderboard_alias: string | null
  full_name: string | null
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase()
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
}

/** Nome + avatar exibidos, respeitando o modo de identidade. Fonte única de verdade. */
export function displayIdentity(p: IdInput): { name: string; avatarUrl: string | null; initials: string } {
  if (p.identity_mode === 'real') {
    const name = p.display_name?.trim() || p.full_name?.trim() || 'Aluno'
    return { name, avatarUrl: p.avatar_url ?? null, initials: initialsOf(name) }
  }
  const name = p.leaderboard_alias?.trim() || 'Aluno'
  return { name, avatarUrl: null, initials: initialsOf(name) }
}

const HANDLE_RE = /^[a-z0-9_.]{3,30}$/

export function isValidHandle(h: string): boolean {
  return HANDLE_RE.test(h)
}

export function suggestHandle(email: string): string {
  const local = (email.split('@')[0] ?? '').toLowerCase()
  let h = local.replace(/\+.*$/, '').replace(/[^a-z0-9_.]/g, '')
  if (h.length < 3) h = (h + 'aluno').slice(0, 30)
  return h.slice(0, 30)
}
