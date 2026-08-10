/**
 * Net-worth composition. Pure + unit-testable. Each component is a paise value
 * that may be negative (e.g. loans, or a net-negative cash balance from credit
 * card dues). Net worth is simply their sum.
 */
export interface NetWorthComponent {
  key: string
  label: string
  color: string
  /** Value in paise; negative reduces net worth. */
  valuePaise: number
}

export interface NetWorthSummary {
  /** Components with a non-zero value, in the order given. */
  components: NetWorthComponent[]
  /** Sum of positive components (for the allocation bar). */
  totalAssetsPaise: number
  netWorthPaise: number
}

export function buildNetWorth(
  components: NetWorthComponent[],
): NetWorthSummary {
  let assets = 0
  let net = 0
  for (const c of components) {
    net += c.valuePaise
    if (c.valuePaise > 0) assets += c.valuePaise
  }
  return {
    components: components.filter((c) => c.valuePaise !== 0),
    totalAssetsPaise: assets,
    netWorthPaise: net,
  }
}
