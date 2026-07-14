import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, requireAuth } from '@/lib/auth'

export async function GET() {
  const settings = await db.settings.findFirst()
  return NextResponse.json({
    id: settings?.id ?? 'default',
    currencyUnit: settings?.currencyUnit ?? 'ریال',
    // Never return the password hash to the client
    hasPassword: Boolean(settings?.adminPassword),
  })
}

export async function PUT(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const { currencyUnit, adminPassword } = body ?? {}

    const data: any = {}
    if (typeof currencyUnit === 'string' && currencyUnit.trim()) {
      data.currencyUnit = currencyUnit.trim()
    }
    if (typeof adminPassword === 'string' && adminPassword.trim().length >= 4) {
      data.adminPassword = await hashPassword(adminPassword.trim())
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'داده‌ای برای به‌روزرسانی ارسال نشده' }, { status: 400 })
    }

    const existing = await db.settings.findFirst()
    let settings
    if (existing) {
      settings = await db.settings.update({ where: { id: existing.id }, data })
    } else {
      settings = await db.settings.create({ data: { ...data } })
    }
    return NextResponse.json({
      id: settings.id,
      currencyUnit: settings.currencyUnit,
      hasPassword: Boolean(settings.adminPassword),
    })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}
