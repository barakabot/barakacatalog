import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { clearProxyPool } from '@/lib/proxy-pool'
import { parseProxyText, type ParsedProxy } from '@/lib/proxy-parser'
import { encryptSecret } from '@/lib/secret-crypto'

const MAX_FILE_SIZE = 1 * 1024 * 1024

function decodeProxyFile(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le')
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const bytes = Buffer.from(buffer.subarray(2))
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const first = bytes[i]
      bytes[i] = bytes[i + 1]
      bytes[i + 1] = first
    }
    return bytes.toString('utf16le')
  }
  return buffer.toString('utf8').replace(/^\uFEFF/, '')
}

function parseJsonProxies(value: unknown): ParsedProxy[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Record<string, unknown>
    const host = String(candidate.host ?? '').trim()
    const port = Number(candidate.port)
    const protocol = String(candidate.protocol ?? 'http').toLowerCase()
    if (!host || /\s/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) return []
    if (protocol !== 'http' && protocol !== 'https') return []
    return [{
      host,
      port,
      username: candidate.username ? String(candidate.username).trim() || null : null,
      password: candidate.password ? String(candidate.password).trim() || null : null,
      protocol,
    } satisfies ParsedProxy]
  })
}

/** GET — list all proxies */
export async function GET() {
  try {
    await requireAuth()
    const proxies = await db.proxy.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        host: true,
        port: true,
        protocol: true,
        username: true,
        status: true,
        latency: true,
        lastCheck: true,
        isActive: true,
        createdAt: true,
      },
    })
    return NextResponse.json(proxies)
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}

/** POST — upload proxy list from text file */
export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    const contentType = req.headers.get('content-type')?.toLowerCase() ?? ''
    let parsed: ParsedProxy[] = []
    let skipped = 0
    let errors: Array<{ line: number; message: string }> = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file')
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'فایل پروکسی ارسال نشده است' }, { status: 400 })
      }
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (!extension || !['txt', 'csv'].includes(extension)) {
        return NextResponse.json({ error: 'فقط فایل‌های TXT و CSV مجاز هستند' }, { status: 400 })
      }
      if (file.size === 0) {
        return NextResponse.json({ error: 'فایل انتخاب‌شده خالی است' }, { status: 400 })
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'حجم فایل نباید بیش از ۱ مگابایت باشد' }, { status: 400 })
      }

      const result = parseProxyText(decodeProxyFile(Buffer.from(await file.arrayBuffer())))
      parsed = result.proxies
      skipped = result.skipped
      errors = result.errors
    } else if (contentType.includes('application/json')) {
      const body = await req.json()
      parsed = parseJsonProxies(body?.proxies)
      skipped = Array.isArray(body?.proxies) ? body.proxies.length - parsed.length : 0
      if (parsed.length === 0) {
        return NextResponse.json({ error: 'فایل یا لیست پروکسی ارسال نشده' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'نوع محتوای درخواست پشتیبانی نمی‌شود' }, { status: 415 })
    }

    if (parsed.length === 0) {
      return NextResponse.json({
        error: errors[0] ? `هیچ پروکسی معتبری پیدا نشد؛ خط ${errors[0].line}: ${errors[0].message}` : 'هیچ پروکسی معتبری پیدا نشد',
      }, { status: 400 })
    }

    const existing = await db.proxy.findMany({ select: { host: true, port: true } })
    const existingKeys = new Set(existing.map(proxy => `${proxy.host.toLowerCase()}:${proxy.port}`))
    const newProxies = parsed.filter(proxy => {
      const key = `${proxy.host.toLowerCase()}:${proxy.port}`
      if (existingKeys.has(key)) {
        skipped++
        return false
      }
      existingKeys.add(key)
      return true
    })

    if (newProxies.length > 0) {
      await db.proxy.createMany({
        data: newProxies.map(proxy => ({
          ...proxy,
          password: proxy.password ? encryptSecret(proxy.password) : null,
          status: 'unknown',
          isActive: true,
        })),
      })
      clearProxyPool()
    }

    return NextResponse.json({
      message: `${newProxies.length} پروکسی اضافه شد${skipped > 0 ? `، ${skipped} مورد تکراری یا نامعتبر رد شد` : ''}`,
      added: newProxies.length,
      skipped,
      errors,
    })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}

/** DELETE — remove all or specific proxy */
export async function DELETE(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const all = searchParams.get('all') === 'true'

    if (all) {
      const count = await db.proxy.deleteMany()
      clearProxyPool()
      return NextResponse.json({ message: `${count.count} پروکسی حذف شد` })
    }

    if (!id) {
      return NextResponse.json({ error: 'شناسه پروکسی مشخص نشده' }, { status: 400 })
    }

    await db.proxy.delete({ where: { id } })
    clearProxyPool()
    return NextResponse.json({ message: 'پروکسی حذف شد' })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}
