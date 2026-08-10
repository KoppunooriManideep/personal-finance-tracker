import { describe, it, expect } from 'vitest'
import {
  baseSymbol,
  parseAmfiNav,
  parseYahooPrice,
  quoteKey,
  yahooTicker,
} from './quotes-shared'

describe('baseSymbol / yahooTicker', () => {
  it('strips NSE trade-series suffixes (…-T, …-BE)', () => {
    expect(baseSymbol('STYLEBAAZA-T')).toBe('STYLEBAAZA')
    expect(baseSymbol('SUZLON-BE')).toBe('SUZLON')
    expect(yahooTicker('STYLEBAAZA-T', 'NSE')).toBe('STYLEBAAZA.NS')
  })

  it('keeps real hyphenated symbols intact', () => {
    expect(baseSymbol('BAJAJ-AUTO')).toBe('BAJAJ-AUTO')
    expect(yahooTicker('BAJAJ-AUTO', null)).toBe('BAJAJ-AUTO.NS')
  })

  it('uses .BO for BSE', () => {
    expect(yahooTicker('AMBER', 'BSE')).toBe('AMBER.BO')
  })
})

describe('quoteKey', () => {
  it('keys MFs by ISIN and stocks by symbol', () => {
    expect(quoteKey('mutual_fund', 'INF846K01CX4', 'Axis Liquid')).toBe(
      'mf:INF846K01CX4',
    )
    expect(quoteKey('stock', 'INE371P01015', 'amber')).toBe('stk:AMBER')
  })
})

describe('parseAmfiNav', () => {
  const SAMPLE = [
    'Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date',
    '120503;INF846K01CX4;INF846K01DX2;Axis Liquid Fund - Direct Plan - Growth;3142.0740;10-Aug-2026',
    'Some Mutual Fund House Name', // junk line, no semicolons
    '119551;INF209K01VC4;-;Some Fund;45.3010;10-Aug-2026',
  ].join('\n')

  it('maps both ISIN columns to the NAV in paise', () => {
    const map = parseAmfiNav(SAMPLE)
    expect(map.get('INF846K01CX4')?.navPaise).toBe(314_207) // round(3142.074×100)
    expect(map.get('INF846K01DX2')?.navPaise).toBe(314_207)
    expect(map.get('INF846K01CX4')?.name).toContain('Axis Liquid')
  })

  it('handles a missing reinvestment ISIN ("-")', () => {
    const map = parseAmfiNav(SAMPLE)
    expect(map.get('INF209K01VC4')?.navPaise).toBe(4_530)
    expect(map.has('-')).toBe(false)
  })
})

describe('parseYahooPrice', () => {
  it('reads price + previous close as paise and the name', () => {
    const json = {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 7435,
              previousClose: 7450,
              longName: 'Amber Enterprises',
            },
          },
        ],
      },
    }
    expect(parseYahooPrice(json)).toEqual({
      pricePaise: 743_500,
      prevClosePaise: 745_000,
      name: 'Amber Enterprises',
    })
  })

  it('returns null price + prevClose when the shape is unexpected', () => {
    expect(parseYahooPrice({}).pricePaise).toBeNull()
    expect(parseYahooPrice({}).prevClosePaise).toBeNull()
    expect(parseYahooPrice({ chart: { result: [] } }).pricePaise).toBeNull()
  })
})
