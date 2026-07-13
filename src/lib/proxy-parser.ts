export interface ParsedProxy {
  host: string
  port: number
  username: string | null
  password: string | null
  protocol: 'http' | 'https'
}

export interface ProxyParseResult {
  proxies: ParsedProxy[]
  skipped: number
  errors: Array<{ line: number; message: string }>
}

function validatePort(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const port = Number(value)
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null
}

function fromUrl(value: string): ParsedProxy | null {
  try {
    const url = new URL(value.includes('://') ? value : `http://${value}`)
    const protocol = url.protocol.replace(':', '').toLowerCase()
    if (protocol !== 'http' && protocol !== 'https') return null
    const port = validatePort(url.port || (protocol === 'https' ? '443' : '80'))
    if (!url.hostname || !port) return null

    return {
      host: url.hostname.replace(/^\[|\]$/g, ''),
      port,
      username: url.username ? decodeURIComponent(url.username) : null,
      password: url.password ? decodeURIComponent(url.password) : null,
      protocol,
    }
  } catch {
    return null
  }
}

export function parseProxyLine(rawLine: string): ParsedProxy | null {
  const line = rawLine.replace(/^\uFEFF/, '').trim()
  if (!line || line.startsWith('#') || line.startsWith('//')) return null

  if (line.includes('://') || line.includes('@') || line.startsWith('[')) {
    return fromUrl(line)
  }

  const separator = line.includes(',') ? ',' : ':'
  const parts = line.split(separator).map(part => part.trim())
  if (parts.length < 2) return null

  const [host, portValue, username, ...passwordParts] = parts
  const port = validatePort(portValue)
  if (!host || !port || /\s/.test(host)) return null

  return {
    host,
    port,
    username: username || null,
    password: passwordParts.length > 0 ? passwordParts.join(separator) || null : null,
    protocol: 'http',
  }
}

export function parseProxyText(text: string, maxEntries = 5000): ProxyParseResult {
  const proxies: ParsedProxy[] = []
  const errors: Array<{ line: number; message: string }> = []
  const seen = new Set<string>()
  let skipped = 0

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index]
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue

    if (proxies.length >= maxEntries) {
      errors.push({ line: index + 1, message: `حداکثر ${maxEntries} پروکسی قابل بارگذاری است` })
      skipped += lines.slice(index).filter(line => line.trim()).length
      break
    }

    const proxy = parseProxyLine(rawLine)
    if (!proxy) {
      skipped++
      if (errors.length < 10) errors.push({ line: index + 1, message: 'فرمت نامعتبر' })
      continue
    }

    const key = `${proxy.protocol}:${proxy.host.toLowerCase()}:${proxy.port}`
    if (seen.has(key)) {
      skipped++
      continue
    }

    seen.add(key)
    proxies.push(proxy)
  }

  return { proxies, skipped, errors }
}
