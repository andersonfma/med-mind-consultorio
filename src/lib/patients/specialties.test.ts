// @vitest-environment node
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually before any Supabase client is created
try {
  const envPath = resolve(process.cwd(), '.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) {
      process.env[key] = value
    }
  }
} catch {
  // .env.local not found — env vars may already be set in CI
}

import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { SPECIALTIES, DIFFICULTIES } from './specialties'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function extractLiterals(constraintDef: string): Set<string> {
  // PostgreSQL normalizes IN ('A','B') to = ANY (ARRAY['A'::text, 'B'::text])
  const arrayMatch = constraintDef.match(/ARRAY\[(.+?)\]/)
  if (arrayMatch) {
    return new Set(
      arrayMatch[1].split(', ').map((s) => s.replace(/^'|'(::text)?$/g, ''))
    )
  }
  // Fallback: match IN ('a', 'b') pattern
  const inMatch = constraintDef.match(/IN \(([^)]+)\)/)
  if (inMatch) {
    return new Set(
      inMatch[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
    )
  }
  throw new Error(`Cannot parse constraint: ${constraintDef}`)
}

describe('cross-validação: constantes TypeScript vs CHECK constraints do banco', () => {
  it('SPECIALTIES bate com o CHECK constraint da coluna specialty', async () => {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('information_schema.check_constraints' as never)
      .select('check_clause')
      .ilike('check_clause' as never, '%Clínica%')
      .limit(1)
      .single()

    if (error || !data) {
      console.warn('Sem acesso a information_schema — pulando specialty cross-val')
      return
    }

    const clause = (data as { check_clause: string }).check_clause
    const dbSet = extractLiterals(clause)
    const tsSet = new Set([...SPECIALTIES])

    for (const s of tsSet) {
      expect(dbSet, `"${s}" em SPECIALTIES mas não no DB constraint`).toContain(s)
    }
    for (const s of dbSet) {
      expect(tsSet, `"${s}" no DB constraint mas não em SPECIALTIES`).toContain(s)
    }
  })

  it('DIFFICULTIES bate com o CHECK constraint da coluna difficulty', async () => {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('information_schema.check_constraints' as never)
      .select('check_clause')
      .ilike('check_clause' as never, '%easy%')
      .limit(1)
      .single()

    if (error || !data) {
      console.warn('Sem acesso a information_schema — pulando difficulty cross-val')
      return
    }

    const clause = (data as { check_clause: string }).check_clause
    const dbSet = extractLiterals(clause)
    const tsSet = new Set([...DIFFICULTIES])

    for (const d of tsSet) {
      expect(dbSet, `"${d}" em DIFFICULTIES mas não no DB constraint`).toContain(d)
    }
    for (const d of dbSet) {
      expect(tsSet, `"${d}" no DB constraint mas não em DIFFICULTIES`).toContain(d)
    }
  })
})
