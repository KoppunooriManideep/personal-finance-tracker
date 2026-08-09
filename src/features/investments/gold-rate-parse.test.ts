import { describe, it, expect } from 'vitest'
import {
  buildGoldRatePayload,
  parseGoldRatesFromHtml,
} from './gold-rate-parse'

// A snippet shaped like the real GoodReturns HTML: ₹ as the &#8377; entity and
// the numbers wrapped in <strong> tags.
const SAMPLE_HTML = `
  <p>Today's gold price in India stands at
  <strong>&#8377;15,235</strong> per gram for 24 karat gold (99.9&percnt; purity),
  <strong>&#8377;13,965</strong> per gram for 22 karat gold (91.6&percnt; purity),
  and <strong>&#8377;11,426</strong> per gram for 18 karat gold (75&percnt; purity).</p>
`

describe('parseGoldRatesFromHtml', () => {
  it('reads 24K / 22K / 18K per-gram rates from the real markup shape', () => {
    const rates = parseGoldRatesFromHtml(SAMPLE_HTML)
    expect(rates).not.toBeNull()
    expect(rates?.rate24kRupees).toBe(15235)
    expect(rates?.rate22kRupees).toBe(13965)
    expect(rates?.rate18kRupees).toBe(11426)
  })

  it('returns null when the 24K rate is absent', () => {
    expect(parseGoldRatesFromHtml('<p>no rates here</p>')).toBeNull()
  })

  it('rejects out-of-range garbage values', () => {
    const html = '<strong>&#8377;12</strong> per gram for 24 karat gold'
    expect(parseGoldRatesFromHtml(html)).toBeNull()
  })
})

describe('buildGoldRatePayload', () => {
  it('converts rupees to paise and carries nullable purities', () => {
    const payload = buildGoldRatePayload(
      { rate24kRupees: 15235, rate22kRupees: 13965, rate18kRupees: null },
      '2026-08-10T00:00:00.000Z',
    )
    expect(payload.rate24kPaise).toBe(1_523_500)
    expect(payload.rate22kPaise).toBe(1_396_500)
    expect(payload.rate18kPaise).toBeNull()
    expect(payload.source).toBe('GoodReturns')
  })
})
