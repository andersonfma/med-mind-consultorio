import { describe, it, expect } from 'vitest'
import { POST } from './route'

describe('POST /api/consultation', () => {
  it('retorna 501 Not Implemented', async () => {
    const response = await POST()
    expect(response.status).toBe(501)
    const body = await response.json()
    expect(body.error).toBe('Not implemented')
  })
})
