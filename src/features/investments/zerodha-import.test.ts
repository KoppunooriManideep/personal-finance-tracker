import { describe, it, expect } from 'vitest'
import { investedPaiseOf, parseZerodhaHoldings } from './zerodha-import'

// Real-shaped Zerodha stock export (tab-separated, extra columns).
const STOCK_TSV = [
  'Symbol\tISIN\tSector\tQuantity Available\tQuantity Discrepant\tQuantity Long Term\tQuantity Pledged\tAverage Price\tPrevious Closing Price\tUnrealized P&L\tUnrealized P&L Pct.',
  'AMBER\tINE371P01015\tENGINEERING\t4\t0\t4\t0\t7511.34\t7435\t-305.36\t-1.0163',
].join('\n')

// Mutual-fund export (comma-separated).
const MF_CSV = [
  'Symbol,ISIN,Instrument Type,Quantity Available,Average Price,Previous Closing Price',
  'AXIS LIQUID FUND - DIRECT PLAN,INF846K01CX4,Debt - Liquid,87.606,3035.8381,3142.074',
].join('\n')

describe('parseZerodhaHoldings', () => {
  it('parses a stock row (INE → stock) by header name', () => {
    const { holdings, skipped } = parseZerodhaHoldings(STOCK_TSV)
    expect(skipped).toBe(0)
    expect(holdings).toHaveLength(1)
    expect(holdings[0]).toEqual({
      kind: 'stock',
      isin: 'INE371P01015',
      symbol: 'AMBER',
      quantity: 4,
      avgPricePaise: 751_134, // ₹7511.34
    })
  })

  it('parses a mutual-fund row (INF → mutual_fund)', () => {
    const { holdings } = parseZerodhaHoldings(MF_CSV)
    expect(holdings).toHaveLength(1)
    expect(holdings[0]).toMatchObject({
      kind: 'mutual_fund',
      isin: 'INF846K01CX4',
      symbol: 'AXIS LIQUID FUND - DIRECT PLAN',
      quantity: 87.606,
      avgPricePaise: 303_584, // round(3035.8381 × 100)
    })
  })

  it('picks "Quantity Available", not other quantity columns', () => {
    const { holdings } = parseZerodhaHoldings(STOCK_TSV)
    expect(holdings[0].quantity).toBe(4) // not the pledged/discrepant 0s
  })

  it('skips rows with unrecognised ISIN or zero quantity', () => {
    const csv = [
      'Symbol,ISIN,Quantity Available,Average Price',
      'GOODROW,INE111A01011,10,100',
      'JUNK,XX000,5,50', // bad ISIN
      'ZEROQTY,INE222B02022,0,50', // zero qty
    ].join('\n')
    const { holdings, skipped } = parseZerodhaHoldings(csv)
    expect(holdings).toHaveLength(1)
    expect(holdings[0].symbol).toBe('GOODROW')
    expect(skipped).toBe(2)
  })

  it('errors on missing required columns', () => {
    const { error } = parseZerodhaHoldings('Foo,Bar\n1,2')
    expect(error).toBeTruthy()
  })

  it('handles thousands separators and quoted fields', () => {
    const csv = [
      'Symbol,ISIN,Quantity Available,Average Price',
      '"BIGCO, LTD",INE999Z01019,"1,000","1,234.50"',
    ].join('\n')
    const { holdings } = parseZerodhaHoldings(csv)
    expect(holdings[0].symbol).toBe('BIGCO, LTD')
    expect(holdings[0].quantity).toBe(1000)
    expect(holdings[0].avgPricePaise).toBe(123_450)
  })
})

describe('investedPaiseOf', () => {
  it('multiplies avg price by quantity', () => {
    expect(
      investedPaiseOf({
        kind: 'stock',
        isin: 'INE371P01015',
        symbol: 'AMBER',
        quantity: 4,
        avgPricePaise: 751_134,
      }),
    ).toBe(3_004_536) // 4 × 7511.34
  })
})
