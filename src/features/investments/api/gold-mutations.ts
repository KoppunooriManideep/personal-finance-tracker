import { supabase } from '@/lib/supabase'
import type { GoldForm } from '@/types/database.types'
import type { GoldHolding } from '@/features/investments/api/gold-queries'

/** Shared fields for creating/updating a gold holding (money in paise, weight mg). */
export interface GoldHoldingWrite {
  ownerId: string | null
  form: GoldForm
  name: string | null
  fineness: number
  weightMg: number
  quantity: number
  purchaseDate: string
  priceTotalPaise: number
  cashbackPaise: number
  rewardValuePaise: number
  voucherSavingsPaise: number
  makingChargesPaise: number
  vaPaise: number
  stoneChargesPaise: number
  gstPercent: number
  discountPaise: number
  website: string | null
  brand: string | null
  notes: string | null
  tags: string[]
}

export interface CreateGoldHoldingInput extends GoldHoldingWrite {
  familyId: string
}

export interface UpdateGoldHoldingInput extends GoldHoldingWrite {
  id: string
}

/** Map the camelCase write shape to the DB row (snake_case). */
function toRow(input: GoldHoldingWrite) {
  return {
    owner_id: input.ownerId,
    form: input.form,
    name: input.name,
    fineness: input.fineness,
    weight_mg: input.weightMg,
    quantity: input.quantity,
    purchase_date: input.purchaseDate,
    price_total_paise: input.priceTotalPaise,
    cashback_paise: input.cashbackPaise,
    reward_value_paise: input.rewardValuePaise,
    voucher_savings_paise: input.voucherSavingsPaise,
    making_charges_paise: input.makingChargesPaise,
    va_paise: input.vaPaise,
    stone_charges_paise: input.stoneChargesPaise,
    gst_percent: input.gstPercent,
    discount_paise: input.discountPaise,
    website: input.website,
    brand: input.brand,
    notes: input.notes,
    tags: input.tags,
  }
}

/**
 * Create a gold holding. The id is generated client-side so we avoid a
 * `.select()` read-back (which would run under the SELECT RLS policy).
 */
export async function createGoldHolding(
  input: CreateGoldHoldingInput,
): Promise<GoldHolding> {
  const id = crypto.randomUUID()

  const { error } = await supabase
    .from('gold_holdings')
    .insert({ id, family_id: input.familyId, ...toRow(input) })

  if (error) throw error

  return { id, ...toHolding(input) }
}

/** Update a gold holding's fields. */
export async function updateGoldHolding(
  input: UpdateGoldHoldingInput,
): Promise<void> {
  const { error } = await supabase
    .from('gold_holdings')
    .update(toRow(input))
    .eq('id', input.id)

  if (error) throw error
}

/** Soft-delete a gold holding (sets `deleted_at`; queries then hide it). */
export async function deleteGoldHolding(id: string): Promise<void> {
  const { error } = await supabase
    .from('gold_holdings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export interface SetGoldSpotInput {
  familyId: string
  /** 24K (999) rate in paise per gram. */
  pricePaisePerGram: number
  source: string | null
}

/** Insert or update the family's current gold spot rate. */
export async function setGoldSpot(input: SetGoldSpotInput): Promise<void> {
  const { error } = await supabase.from('gold_spot').upsert(
    {
      family_id: input.familyId,
      price_paise_per_gram: input.pricePaisePerGram,
      source: input.source,
      as_of: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'family_id' },
  )

  if (error) throw error
}

/** The camelCase holding shape from a write payload (used for optimistic UI). */
function toHolding(input: GoldHoldingWrite): Omit<GoldHolding, 'id'> {
  return {
    ownerId: input.ownerId,
    form: input.form,
    name: input.name,
    fineness: input.fineness,
    weightMg: input.weightMg,
    quantity: input.quantity,
    purchaseDate: input.purchaseDate,
    priceTotalPaise: input.priceTotalPaise,
    cashbackPaise: input.cashbackPaise,
    rewardValuePaise: input.rewardValuePaise,
    voucherSavingsPaise: input.voucherSavingsPaise,
    makingChargesPaise: input.makingChargesPaise,
    vaPaise: input.vaPaise,
    stoneChargesPaise: input.stoneChargesPaise,
    gstPercent: input.gstPercent,
    discountPaise: input.discountPaise,
    website: input.website,
    brand: input.brand,
    notes: input.notes,
    tags: input.tags,
  }
}
