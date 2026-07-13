/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import { parseProxyLine, parseProxyText } from './proxy-parser'

describe('proxy parser', () => {
  test('parses host:port and authenticated proxy lines', () => {
    expect(parseProxyLine('127.0.0.1:8080')).toEqual({
      host: '127.0.0.1',
      port: 8080,
      username: null,
      password: null,
      protocol: 'http',
    })
    expect(parseProxyLine('proxy.example.com:3128:user:pa:ss')).toMatchObject({
      host: 'proxy.example.com',
      port: 3128,
      username: 'user',
      password: 'pa:ss',
    })
  })

  test('parses URL, auth-at-host and CSV formats', () => {
    expect(parseProxyLine('https://user:p%40ss@proxy.example.com:443')).toMatchObject({
      protocol: 'https',
      username: 'user',
      password: 'p@ss',
      host: 'proxy.example.com',
      port: 443,
    })
    expect(parseProxyLine('user:pass@proxy.example.com:8080')).toMatchObject({
      username: 'user',
      password: 'pass',
      host: 'proxy.example.com',
      port: 8080,
    })
    expect(parseProxyLine('proxy.example.com,8080,user,pass')).toMatchObject({
      username: 'user',
      password: 'pass',
    })
  })

  test('handles BOM, comments, duplicates and invalid ports', () => {
    const result = parseProxyText('\uFEFF# proxies\n127.0.0.1:8080\n127.0.0.1:8080\nbad:99999\n')
    expect(result.proxies).toHaveLength(1)
    expect(result.skipped).toBe(2)
    expect(result.errors).toEqual([{ line: 4, message: 'فرمت نامعتبر' }])
  })
})
