import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { getAppSecret } from '@/lib/app-secret'

const PREFIX = 'enc:v1:'

function encryptionKey(): Buffer {
  return createHash('sha256').update(getAppSecret()).digest()
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`
}

export function decryptSecret(value: string | null): string | null {
  if (!value || !value.startsWith(PREFIX)) return value
  const [ivValue, tagValue, encryptedValue] = value.slice(PREFIX.length).split(':')
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('رمز ذخیره‌شدهٔ پروکسی نامعتبر است')

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
