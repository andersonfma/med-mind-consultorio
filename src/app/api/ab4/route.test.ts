import { describe, it, expect } from 'vitest'
import { GET, POST } from './route'

describe('GET /api/ab4', () => {
  it('retorna 501 Not Implemented', async () => {
    const response = await GET()
    expect(response.status).toBe(501)
    const body = await response.json()
    expect(body.error).toBe('Not implemented')
  })
})

describe('POST /api/ab4', () => {
  it('retorna 501 Not Implemented', async () => {
    const response = await POST()
    expect(response.status).toBe(501)
    const body = await response.json()
    expect(body.error).toBe('Not implemented')
  })
})
