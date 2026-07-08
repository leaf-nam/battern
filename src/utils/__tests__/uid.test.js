import { describe, it, expect } from 'vitest'
import { uid } from '../uid.js'

describe('uid', () => {
  it('returns a string', () => {
    expect(typeof uid()).toBe('string')
  })

  it('returns unique values on each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()))
    expect(ids.size).toBe(100)
  })
})
