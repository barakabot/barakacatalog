import { cookies } from 'next/headers'
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { db } from '@/lib/db'
import { getAppSecret } from '@/lib/app-secret'

const SESSION_COOKIE = 'baraka_admin_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const scrypt = promisify(scryptCallback)

interface SessionPayload {
  issuedAt: number
  expiresAt: number
  passwordVersion: string
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function passwordVersion(storedPassword: string): string {
  return createHash('sha256').update(storedPassword).digest('base64url').slice(0, 22)
}

function signPayload(payload: string): string {
  return createHmac('sha256', getAppSecret()).update(payload).digest('base64url')
}

export async function getSettings() {
  return (await db.settings.findFirst()) ?? (await db.settings.create({ data: {} }))
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url')
  const derived = await scrypt(password, salt, 64) as Buffer
  return `scrypt$${salt}$${derived.toString('base64url')}`
}

async function verifyStoredPassword(input: string, stored: string): Promise<boolean> {
  if (!stored.startsWith('scrypt$')) return safeEqual(input, stored)
  const [, salt, expectedValue] = stored.split('$')
  if (!salt || !expectedValue) return false
  const actual = await scrypt(input, salt, 64) as Buffer
  const expected = Buffer.from(expectedValue, 'base64url')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function verifyPassword(input: string): Promise<boolean> {
  const settings = await getSettings()
  const valid = await verifyStoredPassword(input, settings.adminPassword)
  if (valid && !settings.adminPassword.startsWith('scrypt$')) {
    await db.settings.update({
      where: { id: settings.id },
      data: { adminPassword: await hashPassword(input) },
    })
  }
  return valid
}

export async function createSession() {
  const store = await cookies()
  const settings = await getSettings()
  const issuedAt = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = {
    issuedAt,
    expiresAt: issuedAt + SESSION_MAX_AGE,
    passwordVersion: passwordVersion(settings.adminPassword),
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const token = `${encoded}.${signPayload(encoded)}`

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function destroySession() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (!token) return false

    const [encoded, signature] = token.split('.')
    if (!encoded || !signature || !safeEqual(signature, signPayload(encoded))) return false

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload
    const now = Math.floor(Date.now() / 1000)
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= now) return false

    const settings = await getSettings()
    return safeEqual(payload.passwordVersion, passwordVersion(settings.adminPassword))
  } catch {
    return false
  }
}

/** In Route Handler context, throw to produce a 401. */
export async function requireAuth() {
  if (!(await isAuthenticated())) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
}
