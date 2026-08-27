import 'server-only'

// Allowlist de admins por e-mail (server-side). Configurável via env
// ADMIN_EMAILS (lista separada por vírgula); default = dono do projeto.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'andersonbrito.a@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}
