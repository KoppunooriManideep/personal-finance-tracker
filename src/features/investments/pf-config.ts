import type { PfKind } from '@/types/database.types'

/** Display labels for each PF kind. */
export const PF_KINDS: { value: PfKind; label: string }[] = [
  { value: 'epf', label: 'EPF' },
  { value: 'ppf', label: 'PPF' },
  { value: 'vpf', label: 'VPF' },
  { value: 'nps', label: 'NPS' },
]

export function pfKindLabel(kind: PfKind): string {
  return PF_KINDS.find((k) => k.value === kind)?.label ?? kind.toUpperCase()
}

/** Colour for PF in allocation bars / net worth (a teal, distinct from others). */
export const PF_COLOR = '#0d9488'
