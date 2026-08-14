import { NextResponse } from 'next/server'
import buildInfo from '@/build-info.json'

// Endpoint público (sem auth) que revela QUAL build está no ar: commit + horário em que o
// container foi construído. `builtAt` é carimbado pelo Docker no momento do build (ver
// Dockerfile) — se estiver recente, o redeploy realmente reconstruiu o código; se estiver
// velho, o Easypanel reaproveitou um build antigo e o deploy não pegou o push.
// Fora do container (dev/build local) os valores caem no default 'dev'/null.
export const dynamic = 'force-dynamic'

export function GET() {
  const info = buildInfo as { sha: string; builtAt: string | null }
  return NextResponse.json({
    sha: info.sha,
    builtAt: info.builtAt,
    now: new Date().toISOString(),
  })
}
