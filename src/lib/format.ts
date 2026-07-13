/** Format a number as Persian currency (Toman/Rial). */
export function formatCurrency(amount: number | null | undefined, unit = 'ریال'): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '—'
  const formatted = new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0,
  }).format(amount)
  return `${formatted} ${unit}`
}

/** Format a plain number with Persian digits & thousands separators. */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return new Intl.NumberFormat('fa-IR').format(n)
}

/** Convert any number to Persian digits string. */
export function toPersianDigits(s: string | number): string {
  return String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}

/** Format an epoch-ms timestamp as Persian date. */
export function formatPersianDate(ts: number | Date | null | undefined): string {
  if (!ts) return '—'
  const date = typeof ts === 'number' ? new Date(ts) : ts
  if (isNaN(date.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  } catch {
    return date.toLocaleDateString()
  }
}

/** Format epoch-ms as Persian date + time. */
export function formatPersianDateTime(ts: number | Date | null | undefined): string {
  if (!ts) return '—'
  const date = typeof ts === 'number' ? new Date(ts) : ts
  if (isNaN(date.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return date.toLocaleString()
  }
}

/** Convert Rial to Toman (÷10). */
export function rialToToman(rial: number): number {
  return Math.round(rial / 10)
}

/** Generate a slug-ish id. */
export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
