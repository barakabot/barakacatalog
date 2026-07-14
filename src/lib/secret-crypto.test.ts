/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { decryptSecret, encryptSecret } from './secret-crypto'

describe('secret encryption', () => {
  test('encrypts and decrypts proxy passwords', () => {
    const encrypted = encryptSecret('p@ss:word')
    expect(encrypted).not.toContain('p@ss:word')
    expect(decryptSecret(encrypted)).toBe('p@ss:word')
  })

  test('keeps legacy plaintext records readable for migration', () => {
    expect(decryptSecret('legacy-password')).toBe('legacy-password')
    expect(decryptSecret(null)).toBeNull()
  })
})
