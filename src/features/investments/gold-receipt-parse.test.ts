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
      vaNote: null,
    })
  })

  it('derives a VA % note from per-item making amounts', () => {
    const r = normalizeParsedReceipt({
      items: [
        { name: 'bangles', goldValueRupees: 100000, vaRupees: 12000, vaPercent: null },
        { name: 'necklace', goldValueRupees: 50000, vaRupees: 5000, vaPercent: null },
      ],
    })
    expect(r.vaNote).toBe('VA: 12% bangles, 10% necklace')
  })

  it('uses a printed VA % when present and keeps one decimal', () => {
    const r = normalizeParsedReceipt({
      items: [
        { name: 'kante', goldValueRupees: null, vaRupees: null, vaPercent: 12 },
        { name: 'ring', goldValueRupees: 20000, vaRupees: 2100, vaPercent: null },
      ],
    })
    expect(r.vaNote).toBe('VA: 12% kante, 10.5% ring')
  })

  it('aggregates a multi-item bill into one holding (total weight, qty 1)', () => {
    const r = normalizeParsedReceipt({
      weightGrams: 11.955, // model's guess for a single item
      quantity: 2, // the item COUNT — wrong for our weight x quantity model
      items: [
        { name: 'bangles', netWeightGrams: 11.955, goldValueRupees: 100000, vaRupees: 12000 },
        { name: 'necklace', netWeightGrams: 8, goldValueRupees: 50000, vaRupees: 5000 },
      ],
    })
    expect(r.weightGrams).toBe(19.955)
    expect(r.quantity).toBe(1)
  })

  it('keeps quantity for a single repeated item', () => {
    const r = normalizeParsedReceipt({
      weightGrams: 8,
      quantity: 3,
      items: [{ name: 'coin', netWeightGrams: 8, goldValueRupees: 60000 }],
    })
    expect(r.weightGrams).toBe(8)
    expect(r.quantity).toBe(3)
  })

  it('has no VA note when items are missing or unusable', () => {
    expect(normalizeParsedReceipt({}).vaNote).toBeNull()
    expect(
      normalizeParsedReceipt({ items: [{ name: 'x', vaRupees: 100 }] }).vaNote,
    ).toBeNull() // no gold value → cannot derive %
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
