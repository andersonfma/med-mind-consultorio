import { describe, it, expect } from 'vitest'
import { canSeePost } from './visibility'

const base = { authorId: 'a', isPrivate: false, hidden: false, follow: 'none' as const, blocked: false }
const me = { viewerId: 'me' }

describe('canSeePost', () => {
  it('post oculto (moderado) nunca é visível', () => {
    expect(canSeePost(me, { ...base, hidden: true })).toBe(false)
  })
  it('bloqueio esconde mesmo autor público', () => {
    expect(canSeePost(me, { ...base, blocked: true })).toBe(false)
  })
  it('autor público é visível', () => {
    expect(canSeePost(me, base)).toBe(true)
  })
  it('autor privado só com follow aceito', () => {
    expect(canSeePost(me, { ...base, isPrivate: true, follow: 'none' })).toBe(false)
    expect(canSeePost(me, { ...base, isPrivate: true, follow: 'pending' })).toBe(false)
    expect(canSeePost(me, { ...base, isPrivate: true, follow: 'accepted' })).toBe(true)
  })
  it('o próprio autor sempre vê o próprio post (mesmo privado), se não oculto', () => {
    expect(canSeePost({ viewerId: 'a' }, { ...base, isPrivate: true })).toBe(true)
  })
  it('autor não vê o próprio post oculto', () => {
    expect(canSeePost({ viewerId: 'a' }, { ...base, isPrivate: true, hidden: true })).toBe(false)
  })
})
