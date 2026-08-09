import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'
import { formatPaise } from '@/lib/money'
import { ALLOCATION_COLORS } from '@/features/investments/config'

export interface AllocationSlice {
  key: string
  label: string
  /** Value in paise (current value, or effective cost when no rate). */
  value: number
  /** Share of the total, as a percentage. */
  pct: number
}

interface GoldAllocationChartProps {
  slices: AllocationSlice[]
}

/** A donut of portfolio allocation with a percentage legend beside/under it. */
export function GoldAllocationChart({ slices }: GoldAllocationChartProps) {
  const data = slices.filter((s) => s.value > 0)
  if (data.length === 0) return null

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="60%"
              outerRadius="100%"
              paddingAngle={data.length > 1 ? 2 : 0}
              strokeWidth={0}
            >
              {data.map((slice, index) => (
                <Cell
                  key={slice.key}
                  fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, item) => {
                const slice = item?.payload as AllocationSlice | undefined
                return [
                  `${formatPaise(Number(value), { decimals: false })} · ${(
                    slice?.pct ?? 0
                  ).toFixed(1)}%`,
                  slice?.label ?? '',
                ]
              }}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                borderColor: 'hsl(var(--border))',
                borderRadius: 'var(--radius)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="w-full min-w-0 space-y-2">
        {data.map((slice, index) => (
          <li key={slice.key} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className={cn('h-3 w-3 shrink-0 rounded-sm')}
              style={{
                backgroundColor:
                  ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
              }}
            />
            <span className="min-w-0 flex-1 truncate">{slice.label}</span>
            <span className="tabular-nums font-medium">
              {slice.pct.toFixed(1)}%
            </span>
            <span className="text-muted-foreground w-24 shrink-0 text-right tabular-nums">
              {formatPaise(slice.value, { decimals: false })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
