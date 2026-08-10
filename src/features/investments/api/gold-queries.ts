import { supabase } from '@/lib/supabase'
import type { GoldForm } from '@/types/database.types'

/** A physical gold holding (money in paise; weight in milligrams). */
export interface GoldHolding {
  id: string
  /** Family member who owns this; null means Shared / Family. */
  ownerId: string | null
  form: GoldForm
  name: string | null
  /** Fineness in parts-per-thousand (999 = 24K, 916 = 22K, …). */
  fineness: number
  /** Weight of ONE unit, in milligrams. */
  weightMg: number
  quantity: number
  /** ISO date (YYYY-MM-DD). */
  purchaseDate: string
  /** Total amount paid for the whole line, in paise. */
  priceTotalPaise: number
  cashbackPaise: number
  rewardValuePaise: number
  voucherSavingsPaise: number
  /** Jewellery cost breakdown (optional; part of priceTotalPaise, not on top). */
  makingChargesPaise: number
  vaPaise: number
  stoneChargesPaise: number
  /** GST rate on this purchase, as a percentage (e.g. 3 for 3%). */
  gstPercent: number
  /** Discount applied before GST (already baked into priceTotalPaise). */
  discountPaise: number
  website: string | null
  brand: string | null
  notes: string | null
  tags: string[]
}

/** The current 24K (999) spot rate for a family. */
export interface GoldSpot {
  /** Current 24K (999) rate in paise per gram. */
  pricePaisePerGram: number
  source: string | null
  /** ISO timestamp the rate was recorded. */
  asOf: string
}

/** Fetch all (non-deleted) gold holdings for a family, newest purchase first. */
export async function fetchGoldHoldings(
  familyId: string,
): Promise<GoldHolding[]> {
  const { data, error } = await supabase
    .from('gold_holdings')
    .select(
      'id, owner_id, form, name, fineness, weight_mg, quantity, purchase_date, price_total_paise, cashback_paise, reward_value_paise, voucher_savings_paise, making_charges_paise, va_paise, stone_charges_paise, gst_percent, discount_paise, website, brand, notes, tags',
    )
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id ?? null,
    form: row.form,
    name: row.name ?? null,
    fineness: row.fineness,
    weightMg: row.weight_mg,
    quantity: row.quantity,
    purchaseDate: row.purchase_date,
    priceTotalPaise: row.price_total_paise,
    cashbackPaise: row.cashback_paise,
    rewardValuePaise: row.reward_value_paise,
    voucherSavingsPaise: row.voucher_savings_paise,
    makingChargesPaise: row.making_charges_paise,
    vaPaise: row.va_paise,
    stoneChargesPaise: row.stone_charges_paise,
    gstPercent: Number(row.gst_percent),
    discountPaise: row.discount_paise,
    website: row.website ?? null,
    brand: row.brand ?? null,
    notes: row.notes ?? null,
    tags: row.tags ?? [],
  }))
}

/** Fetch the family's current gold spot rate, or null if none set yet. */
export async function fetchGoldSpot(familyId: string): Promise<GoldSpot | null> {
  const { data, error } = await supabase
    .from('gold_spot')
    .select('price_paise_per_gram, source, as_of')
    .eq('family_id', familyId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    pricePaisePerGram: data.price_paise_per_gram,
    source: data.source ?? null,
    asOf: data.as_of,
  }
}
