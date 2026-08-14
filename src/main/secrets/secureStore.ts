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

function ensureSecretsDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
}

function readSecretsFile(filePath: string): SecretsFile {
  if (!existsSync(filePath)) {
    return {}
  }
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as SecretsFile
  return raw
}

function writeSecretsFile(filePath: string, data: SecretsFile): void {
  ensureSecretsDir(filePath)
  writeFileSync(filePath, JSON.stringify(data), { mode: 0o600 })
}

function decodeSecret(crypto: CryptoPort, encoded: string | undefined): string | undefined {
  if (!encoded) {
    return undefined
  }
  if (!crypto.isEncryptionAvailable()) {
    throw new Error('OS encryption unavailable for secrets')
  }
  return crypto.decryptString(Buffer.from(encoded, 'base64'))
}

function encodeSecret(crypto: CryptoPort, plain: string): string {
  if (!crypto.isEncryptionAvailable()) {
    throw new Error('OS encryption unavailable for secrets')
  }
  return crypto.encryptString(plain).toString('base64')
}

/**
 * Encrypted local secrets file under the app userData directory.
 * Uses Electron safeStorage when available; never writes plaintext secrets.
 */
export function createSecureSecretsStore(opts: {
  filePath: string
  crypto: CryptoPort
}): SecureSecretsStore {
  const read = (): SecretsFile => readSecretsFile(opts.filePath)
  const write = (data: SecretsFile): void => writeSecretsFile(opts.filePath, data)

  return {
    has(key) {
      const data = read()
      return Boolean(data[key])
    },
    get(key) {
      return decodeSecret(opts.crypto, read()[key])
    },
    set(key, value) {
      const data = read()
      data[key] = encodeSecret(opts.crypto, value)
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
