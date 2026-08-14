// @vitest-environment node
import { vi, describe, it, expect } from 'vitest'

vi.mock('server-only', () => ({}))

import { getRadarData } from './loader'

// Mock ciente da tabela: cada .from(t).select().eq() resolve com as linhas daquela tabela.
function mockSupabase(rowsByTable: Record<string, unknown[]>) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => Promise.resolve({ data: rowsByTable[table] ?? [], error: null }),
      }),
    }),
  } as unknown as Parameters<typeof getRadarData>[0]
}

describe('getRadarData', () => {
  it('agrega as 4 tabelas do aluno e devolve o RadarResult calculado', async () => {
    const supabase = mockSupabase({
      consultations: [{ ab4_score: { overall: 8, recommendation: 'ok' }, communication_score: { overall: 6, recommendation: 'ok' }, status: 'finished' }],
      patients: [{ diagnosis_status: 'achieved' }],
      exam_requests: [{ status: 'approved' }],
      prescriptions: [{ adequacy: 'adequada' }],
    })
    const result = await getRadarData(supabase, 'user-1')
    expect(result).toEqual({ pensamentoClinico: 8, comunicacao: 6, tecnica: 10, n: 1 })
  })

  it('sem dados → todos os eixos null e n 0', async () => {
    const supabase = mockSupabase({})
    const result = await getRadarData(supabase, 'user-1')
    expect(result).toEqual({ pensamentoClinico: null, comunicacao: null, tecnica: null, n: 0 })
  })
})
