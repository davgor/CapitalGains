import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type SecretKey = 'cursorApiKey' | 'marketDataKey'

export interface CryptoPort {
  isEncryptionAvailable(): boolean
  encryptString(plain: string): Buffer
  decryptString(blob: Buffer): string
}

export interface SecureSecretsStore {
  has(key: SecretKey): boolean
  get(key: SecretKey): string | undefined
  set(key: SecretKey, value: string): void
  clear(key: SecretKey): void
}

interface SecretsFile {
  cursorApiKey?: string
  marketDataKey?: string
}

/**
 * Encrypted local secrets file under the app userData directory.
 * Uses Electron safeStorage when available; never writes plaintext secrets.
 */
export function createSecureSecretsStore(opts: {
  filePath: string
  crypto: CryptoPort
}): SecureSecretsStore {
  const ensureDir = (): void => {
    mkdirSync(dirname(opts.filePath), { recursive: true })
  }

  const read = (): SecretsFile => {
    if (!existsSync(opts.filePath)) {
      return {}
    }
    const raw = JSON.parse(readFileSync(opts.filePath, 'utf8')) as SecretsFile
    return raw
  }

  const write = (data: SecretsFile): void => {
    ensureDir()
    writeFileSync(opts.filePath, JSON.stringify(data), { mode: 0o600 })
  }

  const decode = (encoded: string | undefined): string | undefined => {
    if (!encoded) {
      return undefined
    }
    if (!opts.crypto.isEncryptionAvailable()) {
      throw new Error('OS encryption unavailable for secrets')
    }
    return opts.crypto.decryptString(Buffer.from(encoded, 'base64'))
  }

  const encode = (plain: string): string => {
    if (!opts.crypto.isEncryptionAvailable()) {
      throw new Error('OS encryption unavailable for secrets')
    }
    return opts.crypto.encryptString(plain).toString('base64')
  }

  return {
    has(key) {
      const data = read()
      return Boolean(data[key])
    },
    get(key) {
      return decode(read()[key])
    },
    set(key, value) {
      const data = read()
      data[key] = encode(value)
      write(data)
    },
    clear(key) {
      const data = read()
      delete data[key]
      write(data)
    }
  }
}

export function defaultSecretsPath(userDataPath: string): string {
  return join(userDataPath, 'secrets', 'keys.enc.json')
}
