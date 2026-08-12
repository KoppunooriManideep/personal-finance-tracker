import { describe, it, expect } from 'vitest'
import { normalizeParsedReceipt } from './gold-receipt-parse'

describe('normalizeParsedReceipt', () => {
  it('passes through a clean jewellery bill (Mukunda-style)', () => {
    const r = normalizeParsedReceipt({
      form: 'jewellery',
      fineness: 916,
      name: 'G KANTE',
      weightGrams: 11.955,
      quantity: 1,
      purchaseDate: '2026-07-24',
      priceTotal: 178920,
      makingCharges: 18985,
      va: null,
      stoneCharges: 1815,
      gstPercent: 3,
      discount: 5254,
      brand: 'Mukunda Jewellery',
    })
    expect(r).toEqual({
      form: 'jewellery',
      fineness: 916,
      name: 'G KANTE',
      weightGrams: 11.955,
      quantity: 1,
      purchaseDate: '2026-07-24',
      priceTotal: 178920,
      makingCharges: 18985,
      va: null,
      stoneCharges: 1815,
      gstPercent: 3,
      discount: 5254,
      brand: 'Mukunda Jewellery',
    })
  })

  it('strips commas from numeric strings and snaps fineness', () => {
    const r = normalizeParsedReceipt({
      fineness: 917, // → nearest allowed 916
      priceTotal: '1,78,920',
    })
    expect(r.fineness).toBe(916)
    expect(r.priceTotal).toBe(178920)
  })

  it('nulls out invalid / out-of-range / missing values', () => {
    const r = normalizeParsedReceipt({
      form: 'ring', // not a valid kind
      quantity: 0, // must be >= 1
      gstPercent: 150, // > 100
      priceTotal: -5, // negative
      purchaseDate: '24/07/2026', // not ISO
      weightGrams: 'abc',
    })
    expect(r.form).toBeNull()
    expect(r.quantity).toBeNull()
    expect(r.gstPercent).toBeNull()
    expect(r.priceTotal).toBeNull()
    expect(r.purchaseDate).toBeNull()
    expect(r.weightGrams).toBeNull()
  })

  it('handles a totally empty / non-object input', () => {
    const r = normalizeParsedReceipt(null)
    expect(r.form).toBeNull()
    expect(r.priceTotal).toBeNull()
    expect(r.brand).toBeNull()
  })
})
