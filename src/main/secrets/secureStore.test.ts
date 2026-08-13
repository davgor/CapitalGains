import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSecureSecretsStore, type CryptoPort } from './secureStore'

let dir: string

const cryptoPort: CryptoPort = {
  isEncryptionAvailable: () => true,
  encryptString: (plain) => Buffer.from(`enc:${plain}`, 'utf8'),
  decryptString: (blob) => {
    const s = blob.toString('utf8')
    if (!s.startsWith('enc:')) {
      throw new Error('bad blob')
    }
    return s.slice(4)
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cg-secrets-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('secureSecretsStore', () => {
  it('stores secrets encrypted and never as plaintext in the file', () => {
    const store = createSecureSecretsStore({
      filePath: join(dir, 'keys.enc.json'),
      crypto: cryptoPort
    })
    store.set('cursorApiKey', 'sk-secret-value')
    expect(store.has('cursorApiKey')).toBe(true)
    expect(store.get('cursorApiKey')).toBe('sk-secret-value')
    const disk = readFileSync(join(dir, 'keys.enc.json'), 'utf8')
    expect(disk).not.toContain('sk-secret-value')
    const parsed = JSON.parse(disk) as { cursorApiKey: string }
    expect(Buffer.from(parsed.cursorApiKey, 'base64').toString('utf8')).toBe('enc:sk-secret-value')
  })

  it('clears a secret', () => {
    const store = createSecureSecretsStore({
      filePath: join(dir, 'keys.enc.json'),
      crypto: cryptoPort
    })
    store.set('marketDataKey', 'md-key')
    store.clear('marketDataKey')
    expect(store.has('marketDataKey')).toBe(false)
  })
})
