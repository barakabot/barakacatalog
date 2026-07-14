import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const count = await db.product.count({ where: { deletedAt: { not: null } } })
  return NextResponse.json({ count })
}