// @vitest-environment node
import { vi, describe, it, expect } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/build-info.json', () => ({ default: { sha: 'abc1234', builtAt: '2026-08-14T10:00:00Z' } }))

import { GET } from './route'

describe('GET /api/version', () => {
  it('retorna sha e builtAt carimbados no build, sem exigir auth', async () => {
    const res = GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sha).toBe('abc1234')
    expect(body.builtAt).toBe('2026-08-14T10:00:00Z')
    expect(typeof body.now).toBe('string')
  })
})
