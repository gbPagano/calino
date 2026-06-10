#!/usr/bin/env node

/**
 * Encrypt a CalDAV password with a master password.
 *
 * Usage:
 *   node scripts/encrypt-password.mjs --master "your-master-password" --password "your-caldav-password"
 *
 * Output: JSON blob ready to paste into calino.config.json
 */

import { webcrypto } from 'node:crypto'

// Polyfill globalThis.crypto for Node.js < 19
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto
}

const PBKDF2_ITERATIONS = 100_000

function parseArgs() {
  const args = process.argv.slice(2)
  let master = null
  let password = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--master' && args[i + 1]) {
      master = args[++i]
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[++i]
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: encrypt-password --master <master-password> --password <caldav-password>

Options:
  --master <password>     Master password to encrypt with
  --password <password>   CalDAV password to encrypt
  --help, -h              Show this help

Example:
  node scripts/encrypt-password.mjs --master "my-master-pass" --password "my-caldav-pass"
`)
      process.exit(0)
    }
  }

  if (!master || !password) {
    console.error('Error: Both --master and --password are required')
    console.error('Run with --help for usage')
    process.exit(1)
  }

  return { master, password }
}

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64url')
}

async function deriveKey(password, salt) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
}

async function encrypt(plaintext, masterPassword) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(masterPassword, salt)
  const encoder = new TextEncoder()

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )

  return {
    ciphertext: toBase64(encrypted),
    iv: toBase64(iv.buffer),
    salt: toBase64(salt.buffer),
  }
}

async function main() {
  const { master, password } = parseArgs()

  console.log('\nEncrypting CalDAV password...')
  console.log(`Master password: ${'*'.repeat(master.length)}`)
  console.log(`CalDAV password: ${'*'.repeat(password.length)}`)
  console.log('')

  const encrypted = await encrypt(password, master)

  console.log('Encrypted blob (paste into calino.config.json):')
  console.log('─'.repeat(50))
  console.log(JSON.stringify(encrypted, null, 2))
  console.log('─'.repeat(50))
  console.log('\nFull account entry example:')
  console.log(JSON.stringify({
    name: 'My Account',
    url: 'https://caldav.example.com/dav.php',
    username: 'user@example.com',
    password: encrypted,
  }, null, 2))
}

main().catch((err) => {
  console.error('Encryption failed:', err)
  process.exit(1)
})
