import { describe, it, expect } from 'vitest'
import { planMarketImport } from './import-plan'
import type { MarketHolding } from '@/features/investments/api/market-queries'
import type { MarketHoldingWrite } from '@/features/investments/api/market-mutations'

function write(over: Partial<MarketHoldingWrite> = {}): MarketHoldingWrite {
  return {
    ownerId: null,
    kind: 'mutual_fund',
    isin: 'INF846K01CX4',
    symbol: 'Axis Liquid Fund',
    exchange: null,
    name: null,
    quantity: 100,
    investedPaise: 300_000_000,
    notes: null,
    tags: [],
    ...over,
  }
}

function existing(over: Partial<MarketHolding> = {}): MarketHolding {
  return {
    id: 'h1',
    ownerId: 'alice',
    kind: 'mutual_fund',
    isin: 'INF846K01CX4',
    symbol: 'Axis Liquid Fund',
    exchange: null,
    name: 'Axis Liquid Fund - Direct Growth',
    quantity: 87,
    investedPaise: 260_000_000,
    notes: 'started 2024',
    tags: ['sip'],
    ...over,
  }
}

describe('planMarketImport', () => {
  it('updates an existing holding by ISIN (SIP top-up), keeping owner/name/tags', () => {
    const plan = planMarketImport([write({ quantity: 100 })], [existing()])
    expect(plan.inserts).toHaveLength(0)
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0].id).toBe('h1')
    expect(plan.updates[0].input.quantity).toBe(100) // refreshed units
    expect(plan.updates[0].input.ownerId).toBe('alice') // owner preserved
    expect(plan.updates[0].input.name).toBe('Axis Liquid Fund - Direct Growth')
    expect(plan.updates[0].input.tags).toEqual(['sip'])
  })

  it('inserts a new ISIN', () => {
    const plan = planMarketImport(
      [write({ isin: 'INF209K01VC4', symbol: 'New Fund' })],
      [existing()],
    )
    expect(plan.updates).toHaveLength(0)
    expect(plan.inserts).toHaveLength(1)
    expect(plan.inserts[0].symbol).toBe('New Fund')
  })

  it('collapses duplicate ISIN rows in the file', () => {
    const plan = planMarketImport(
      [write({ isin: 'INE371P01015' }), write({ isin: 'INE371P01015' })],
      [],
    )
    expect(plan.inserts).toHaveLength(1)
  })
})
