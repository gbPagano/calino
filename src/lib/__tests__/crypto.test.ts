import { describe, it, expect } from 'vitest'
import {
  encryptPassword,
  decryptPassword,
  isEncryptedPassword,
} from '../crypto'

describe('crypto', () => {
  describe('encryptPassword / decryptPassword', () => {
    it('round-trips a password through encrypt/decrypt', async () => {
      const password = 'my-secret-calDAV-password-123'
      const encrypted = await encryptPassword(password)

      expect(encrypted.iv).toBeTruthy()
      expect(encrypted.data).toBeTruthy()
      expect(encrypted.iv).not.toBe(password)
      expect(encrypted.data).not.toBe(password)

      const decrypted = await decryptPassword(encrypted)
      expect(decrypted).toBe(password)
    })

    it('produces different ciphertext for the same password (random IV)', async () => {
      const password = 'same-password'
      const enc1 = await encryptPassword(password)
      const enc2 = await encryptPassword(password)

      // Different IVs → different ciphertext
      expect(enc1.iv).not.toBe(enc2.iv)
      expect(enc1.data).not.toBe(enc2.data)

      // Both decrypt to the same value
      expect(await decryptPassword(enc1)).toBe(password)
      expect(await decryptPassword(enc2)).toBe(password)
    })

    it('handles empty string password', async () => {
      const encrypted = await encryptPassword('')
      const decrypted = await decryptPassword(encrypted)
      expect(decrypted).toBe('')
    })

    it('handles special characters and unicode', async () => {
      const password = 'pà$$w0rd!@#$%^&*()_+{}|:"<>?🚀'
      const encrypted = await encryptPassword(password)
      const decrypted = await decryptPassword(encrypted)
      expect(decrypted).toBe(password)
    })

    it('handles long passwords', async () => {
      const password = 'a'.repeat(1000)
      const encrypted = await encryptPassword(password)
      const decrypted = await decryptPassword(encrypted)
      expect(decrypted).toBe(password)
    })
  })

  describe('isEncryptedPassword', () => {
    it('returns true for encrypted format', () => {
      expect(isEncryptedPassword({ iv: 'abc', data: 'def' })).toBe(true)
    })

    it('returns false for plaintext string', () => {
      expect(isEncryptedPassword('my-password')).toBe(false)
    })

    it('returns false for null/undefined', () => {
      expect(isEncryptedPassword(null)).toBe(false)
      expect(isEncryptedPassword(undefined)).toBe(false)
    })

    it('returns false for partial objects', () => {
      expect(isEncryptedPassword({ iv: 'abc' })).toBe(false)
      expect(isEncryptedPassword({ data: 'abc' })).toBe(false)
    })
  })
})
