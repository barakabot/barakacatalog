import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { getNextProxy } from '@/lib/proxy-pool'

const PRICE_SERVICE = process.env.PRICE_SERVICE_URL ?? 'http://localhost:3002'

const SOURCE_MAP: Record<string, string> = {
  'دیجی‌کالا': 'DIGIKALA',
  'digikala': 'DIGIKALA',
  'دیجیکالا': 'DIGIKALA',
  'اسنپ‌شاپ': 'SNAPPSHOP',
  'snappshop': 'SNAPPSHOP',
  'snapp': 'SNAPPSHOP',
  'ترب': 'TOROB',
  'torob': 'TOROB',
}

// Minimal columns: source + sourceId are required, coefficient & catalogProductName optional
const COL_MAP: Record<string, string> = {
  'منبع': 'source',
  'source': 'source',
  'شناسه': 'sourceId',
  'شناسه منبع': 'sourceId',
  'sourceid': 'sourceId',
  'source_id': 'sourceId',
  'کد محصول': 'sourceId',
  'ضریب': 'coefficient',
  'coefficient': 'coefficient',
  'محصول کاتالوگ': 'catalogProductName',
  'catalogproduct': 'catalogProductName',
}

function normalizeSource(val: any): string | null {
  const s = String(val ?? '').trim()
  if (!s) return null
  if (['DIGIKALA', 'SNAPPSHOP', 'TOROB'].includes(s.toUpperCase())) return s.toUpperCase()
  return SOURCE_MAP[s.toLowerCase()] ?? SOURCE_MAP[s] ?? s.toUpperCase()
}

function parseNum(val: any): number | null {
  const s = String(val ?? '').replace(/[,،\s٪%]/g, '').replace(/[۰-۹]/g, (d: string) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  if (!s) return null
  const n = Number(s)
  return isNaN(n) || n < 0 ? null : n
}

/** Scrape a single product from the price-service */
async function scrapeOne(source: string, sourceId: string): Promise<{
  success: boolean
  data?: {
    source: string
    sourceId: string
    name: string
    imageUrl: string | null
    weight: string | null
    volume: string | null
    price: number
    originalPrice: number | null
    discountPercent: number
    brand: string | null
  }
  error?: string
}> {
  try {
    const proxyUrl = await getNextProxy()
    const res = await fetch(`${PRICE_SERVICE}/api/competitors/scrape-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, sourceId, proxy: proxyUrl }),
      signal: AbortSignal.timeout(15000),
    })
    const json = await res.json()
    if (res.ok && json?.data) {
      return { success: true, data: { source, sourceId, ...json.data } }
    }
    return { success: false, error: json?.error ?? `خطای ${res.status}` }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'خطای اسکرپ' }
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'فایلی ارسال نشده' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      return NextResponse.json({ error: 'فقط فایل‌های xlsx, xls یا csv مجاز هستند' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم فایل نباید بیش از ۱۰ مگابایت باشد' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'فایل اکسل خالی است' }, { status: 400 })
    }
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'هیچ ردیفی در فایل یافت نشد' }, { status: 400 })
    }

    // Map column headers
    const headerMap = new Map<string, string>()
    const rawHeaders = Object.keys(rows[0])
    for (const h of rawHeaders) {
      const key = COL_MAP[h.trim().toLowerCase()] ?? COL_MAP[h.trim()]
      if (key) headerMap.set(h, key)
    }

    if (![...headerMap.values()].includes('source')) {
      return NextResponse.json({ error: 'ستون «منبع» یافت نشد' }, { status: 400 })
    }
    if (![...headerMap.values()].includes('sourceId')) {
      return NextResponse.json({ error: 'ستون «شناسه» یافت نشد' }, { status: 400 })
    }

    // Fetch all catalog products for name→id lookup
    const allProducts = await db.product.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    })
    const productByName = new Map(allProducts.map((p) => [p.name.trim(), p.id]))

    // Parse all rows and scrape in parallel (max 5 concurrent)
    interface RowResult {
      rowNum: number
      sourceId: string
      source: string
      coefficient: number | null
      catalogProductId: string | null
      catalogProductName: string
      // scrape result
      scraped?: {
        name: string
        imageUrl: string | null
        weight: string | null
        volume: string | null
        price: number
        originalPrice: number | null
        discountPercent: number
        brand: string | null
      }
      scrapeError?: string
      // duplicate check
      existingId?: string
    }

    const results: RowResult[] = []
    const BATCH = 5

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const batchResults = await Promise.all(
        batch.map(async (row, bi) => {
          const rowNum = i + bi + 2
          const mapped: Record<string, any> = {}
          for (const [header, field] of headerMap) {
            mapped[field] = row[header]
          }

          const sourceId = String(mapped.sourceId ?? '').trim()
          const source = normalizeSource(mapped.source)
          const coefficient = parseNum(mapped.coefficient)
          const catalogProductName = String(mapped.catalogProductName ?? '').trim()
          const catalogProductId = catalogProductName ? (productByName.get(catalogProductName) ?? null) : null

          const result: RowResult = {
            rowNum,
            sourceId,
            source: source ?? 'UNKNOWN',
            coefficient,
            catalogProductId,
            catalogProductName,
          }

          if (!sourceId) {
            result.scrapeError = 'شناسه خالی'
            return result
          }
          if (!source) {
            result.scrapeError = 'منبع نامعتبر'
            return result
          }

          // Check for existing competitor with same source + sourceId
          const existing = await db.competitorProduct.findFirst({
            where: { source, sourceId },
            select: { id: true },
          })
          if (existing) {
            result.existingId = existing.id
          }

          // Scrape
          const scrape = await scrapeOne(source, sourceId)
          if (scrape.success && scrape.data) {
            result.scraped = {
              name: scrape.data.name,
              imageUrl: scrape.data.imageUrl,
              weight: scrape.data.weight,
              volume: scrape.data.volume,
              price: scrape.data.price,
              originalPrice: scrape.data.originalPrice,
              discountPercent: scrape.data.discountPercent,
              brand: scrape.data.brand,
            }
          } else {
            result.scrapeError = scrape.error ?? 'اسکرپ ناموفق'
          }

          return result
        })
      )
      results.push(...batchResults)
    }

    const scraped = results.filter(r => r.scraped).length
    const failed = results.filter(r => !r.scraped).length

    return NextResponse.json({
      message: `اسکرپ تکمیل شد: ${scraped} موفق، ${failed} ناموفق`,
      total: rows.length,
      scraped,
      failed,
      results,
    })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}

/** Save selected scraped results */
export async function PUT(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const { items } = body as {
      items: Array<{
        sourceId: string
        source: string
        coefficient?: number | null
        catalogProductId?: string | null
        name: string
        imageUrl?: string | null
        weight?: string | null
        volume?: string | null
        price: number
        originalPrice?: number | null
        discountPercent?: number
        brand?: string | null
      }>
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'آیتمی برای ذخیره ارسال نشده' }, { status: 400 })
    }

    let created = 0
    let updated = 0

    for (const item of items) {
      const data: any = {
        source: item.source,
        sourceId: item.sourceId,
        name: item.name,
        price: item.price,
        originalPrice: item.originalPrice ?? null,
        discountPercent: item.discountPercent ?? null,
        coefficient: item.coefficient ?? null,
        brand: item.brand ?? null,
        imageUrl: item.imageUrl ?? null,
        weight: item.weight ?? null,
        volume: item.volume ?? null,
        catalogProductId: item.catalogProductId ?? null,
        fetchedAt: new Date(),
      }

      // Check existing by source + sourceId
      const existing = await db.competitorProduct.findFirst({
        where: { source: item.source, sourceId: item.sourceId },
      })

      if (existing) {
        await db.competitorProduct.update({ where: { id: existing.id }, data })
        updated++
      } else {
        const cp = await db.competitorProduct.create({ data })
        // Seed price history
        if (item.price != null) {
          await db.competitorPriceHistory.create({
            data: {
              competitorProductId: cp.id,
              price: item.price,
              originalPrice: item.originalPrice ?? null,
              discountPercent: item.discountPercent ?? null,
            },
          })
        }
        created++
      }
    }

    return NextResponse.json({ message: 'ذخیره شد', created, updated })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}