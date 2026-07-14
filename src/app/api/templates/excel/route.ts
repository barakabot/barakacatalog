import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function GET() {
  try {
    await requireAuth()

    const wb = XLSX.utils.book_new()

    // === Products template ===
    const productHeaders = ['نام', 'قیمت', 'توضیحات', 'گروه', 'لینک تصویر', 'حاشیه سود', 'مزیت رقابتی', 'بازار هدف', 'پروموشن']
    const productExample = [
      'هدفون بی‌سیم سونی WH-1000XM5',
      '10,000,000',
      'هدفون نویز کنسلینگ پریمیوم',
      'لوازم الکترونیکی',
      'https://example.com/image.jpg',
      '15',
      'کیفیت صدای عالی',
      'بازار ایران',
      '۲۰٪ تخفیف ویژه',
    ]
    const productNote = [
      '(الزامی)',
      '(عدد، بدون واحد)',
      '',
      '(نام گروه موجود)',
      '',
      '(درصد)',
      '',
      '',
      '',
    ]
    const ws1 = XLSX.utils.aoa_to_sheet([productHeaders, productExample, productNote])
    ws1['!cols'] = [
      { wch: 35 }, { wch: 18 }, { wch: 30 }, { wch: 18 },
      { wch: 30 }, { wch: 12 }, { wch: 25 }, { wch: 18 }, { wch: 20 },
    ]
    XLSX.utils.book_append_sheet(wb, ws1, 'محصولات')

    // === Competitors template ===
    const compHeaders = ['منبع', 'شناسه', 'ضریب', 'محصول کاتالوگ']
    const compExample = [
      'دیجی‌کالا',
      '11070303',
      '1.1',
      'هدفون بی‌سیم سونی WH-1000XM5',
    ]
    const compExample2 = [
      'اسنپ‌شاپ',
      '12345',
      '1.15',
      '',
    ]
    const compExample3 = [
      'ترب',
      'prk-67890',
      '',
      '',
    ]
    const compNote = [
      '(الزامی: دیجی‌کالا / اسنپ‌شاپ / ترب)',
      '(الزامی: کد محصول در سایت منبع)',
      '(اختیاری: ضریب ضرب قیمت)',
      '(اختیاری: نام محصول کاتالوگ برای اتصال)',
    ]
    const ws2 = XLSX.utils.aoa_to_sheet([compHeaders, compExample, compExample2, compExample3, compNote])
    ws2['!cols'] = [
      { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 35 },
    ]
    XLSX.utils.book_append_sheet(wb, ws2, 'رقبا (اسکرپ خودکار)')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=baraka-template.xlsx',
      },
    })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}