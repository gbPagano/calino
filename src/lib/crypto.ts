/**
 * CalDAV Password Encryption
 *
 * Encrypts CalDAV passwords before storing in localStorage.
 * Uses a fixed app-derived key (obfuscation, not true security).
 * Protects against casual inspection, not XSS.
 */

const APP_SECRET = 'calino-caldav-v1-2024'
const APP_SALT = 'calino-salt-v1-2024'
const PBKDF2_ITERATIONS = 100_000

export interface EncryptedData {
  iv: string
  data: string
}

let cachedKey: CryptoKey | null = null

async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey

  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(APP_SECRET),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(APP_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )

  return cachedKey
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function encryptPassword(password: string): Promise<EncryptedData> {
  const key = await getEncryptionKey()
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(password)
  )

  return {
    iv: toBase64(iv.buffer),
    data: toBase64(encrypted),
  }
}

export async function decryptPassword(encrypted: EncryptedData): Promise<string> {
  const key = await getEncryptionKey()
  const decoder = new TextDecoder()
  const iv = fromBase64(encrypted.iv)
  const data = fromBase64(encrypted.data)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )

  return decoder.decode(decrypted)
}

/**
 * Check if a password value is in the new encrypted format.
 */
export function isEncryptedPassword(value: unknown): value is EncryptedData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'iv' in value &&
    'data' in value &&
    typeof (value as EncryptedData).iv === 'string' &&
    typeof (value as EncryptedData).data === 'string'
  )
}
