import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'رمز عبور الزامی است' }, { status: 400 })
    }
    const ok = await verifyPassword(password)
    if (!ok) {
      return NextResponse.json({ error: 'رمز عبور نادرست است' }, { status: 401 })
    }
    await createSession()
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}
