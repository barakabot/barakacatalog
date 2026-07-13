import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

// Expected columns (Persian headers → field names)
const COL_MAP: Record<string, string> = {
  'نام': 'name',
  'name': 'name',
  'نام محصول': 'name',
  'توضیحات': 'description',
  'description': 'description',
  'قیمت': 'price',
  'price': 'price',
  'تصویر': 'imageUrl',
  'image': 'imageUrl',
  'imageUrl': 'imageUrl',
  'لینک تصویر': 'imageUrl',
  'گروه': 'groupName',
  'group': 'groupName',
  'مزیت رقابتی': 'competitiveAdvantage',
  'competitiveadvantage': 'competitiveAdvantage',
  'پروموشن': 'promotionDescription',
  'promotion': 'promotionDescription',
  'promotiondescription': 'promotionDescription',
  'بازار هدف': 'targetMarket',
  'targetmarket': 'targetMarket',
  'حاشیه سود': 'margin',
  'margin': 'margin',
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'فایلی ارسال نشده' }, { status: 400 })
    }

    // Validate extension
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      return NextResponse.json({ error: 'فقط فایل‌های xlsx, xls یا csv مجاز هستند' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم فایل نباید بیش از ۱۰ مگابایت باشد' }, { status: 400 })
    }

    // Parse the file
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
      if (key) {
        headerMap.set(h, key)
      }
    }

    if (![...headerMap.values()].includes('name')) {
      return NextResponse.json(
        { error: 'ستون «نام» یافت نشد. حداقل ستون نام الزامی است.' },
        { status: 400 }
      )
    }

    // Fetch all groups for name→id lookup
    const allGroups = await db.productGroup.findMany({ select: { id: true, name: true } })
    const groupByName = new Map(allGroups.map((g) => [g.name.trim(), g.id]))

    let created = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // Excel rows start from 1, header is row 1

      const mapped: Record<string, any> = {}
      for (const [header, field] of headerMap) {
        mapped[field] = row[header]
      }

      const name = String(mapped.name ?? '').trim()
      if (!name) {
        errors.push(`ردیف ${rowNum}: نام محصول خالی است — رد شد`)
        skipped++
        continue
      }

      // Parse price — handle Persian/Arabic digits and commas
      const priceRaw = String(mapped.price ?? '')
        .replace(/[,،\s]/g, '')
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      const price = priceRaw ? Number(priceRaw) : 0
      if (mapped.price !== '' && mapped.price !== undefined && (isNaN(price) || price < 0)) {
        errors.push(`ردیف ${rowNum}: قیمت نامعتبر «${mapped.price}» — رد شد`)
        skipped++
        continue
      }

      // Parse margin
      let margin: number | null = null
      if (mapped.margin !== '' && mapped.margin !== undefined) {
        const mRaw = String(mapped.margin)
          .replace(/[,،\s٪%]/g, '')
          .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        const m = Number(mRaw)
        if (!isNaN(m)) margin = m
      }

      // Resolve group
      let groupId: string | null = null
      const groupName = String(mapped.groupName ?? '').trim()
      if (groupName) {
        groupId = groupByName.get(groupName) ?? null
        if (!groupId) {
          errors.push(`ردیف ${rowNum}: گروه «${groupName}» یافت نشد — بدون گروه ثبت می‌شود`)
        }
      }

      const productData = {
        name,
        description: String(mapped.description ?? '').trim() || null,
        price: isNaN(price) ? 0 : price,
        imageUrl: String(mapped.imageUrl ?? '').trim() || null,
        groupId,
        competitiveAdvantage: String(mapped.competitiveAdvantage ?? '').trim() || null,
        promotionDescription: String(mapped.promotionDescription ?? '').trim() || null,
        targetMarket: String(mapped.targetMarket ?? '').trim() || null,
        margin,
      }

      // Find existing active product by name
      const existing = await db.product.findFirst({
        where: {
          name: { equals: name },
          deletedAt: null,
        },
      })

      if (existing) {
        await db.product.update({
          where: { id: existing.id },
          data: productData,
        })
        updated++
      } else {
        // Check soft-deleted product — restore & update
        const deleted = await db.product.findFirst({
          where: {
            name: { equals: name },
            deletedAt: { not: null },
          },
        })
        if (deleted) {
          await db.product.update({
            where: { id: deleted.id },
            data: { ...productData, deletedAt: null },
          })
          updated++
        } else {
          await db.product.create({ data: productData })
          created++
        }
      }
    }

    return NextResponse.json({
      message: 'ورود اطلاعات تکمیل شد',
      total: rows.length,
      created,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}