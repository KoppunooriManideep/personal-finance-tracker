import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPaise } from '@/lib/money'
import { formatMonthYear } from '@/lib/date'
import { dateForMonth } from '@/features/chits/chit-math'
import type { Chit } from '@/features/chits/api/chit-queries'
import type { ChitPayment } from '@/features/chits/api/chit-payment-queries'

interface ChitProgressChartProps {
  chit: Chit
  payments: ChitPayment[]
}

interface ChartRow {
  month: number
  /** Cumulative amount paid through this month, in paise. */
  paid: number
  /** Cumulative amount received through this month, in paise. */
  received: number
}

/** Compact INR for axis ticks, e.g. ₹8.8L / ₹1.2Cr / ₹34k. */
function compactInr(paise: number): string {
  const rupees = paise / 100
  const abs = Math.abs(rupees)
  const sign = rupees < 0 ? '-' : ''
  const fmt = (n: number) => n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, '')
  if (abs >= 1e7) return `${sign}₹${fmt(abs / 1e7)}Cr`
  if (abs >= 1e5) return `${sign}₹${fmt(abs / 1e5)}L`
  if (abs >= 1e3) return `${sign}₹${fmt(abs / 1e3)}k`
  return `${sign}₹${Math.round(abs)}`
}

/**
 * Cumulative "money in vs money out" chart: how much you have paid in over the
 * months against how much you have received. Once the received line rises above
 * the paid line, you are in profit. Both series are non-negative so the axis
 * stays simple to read.
 */
export function ChitProgressChart({ chit, payments }: ChitProgressChartProps) {
  const paymentByMonth = new Map(payments.map((p) => [p.monthNumber, p]))
  const recordedMax = payments.reduce((max, p) => Math.max(max, p.monthNumber), 0)
  const lastMonth = Math.max(recordedMax, chit.receivedMonth ?? 0)

  if (lastMonth === 0) return null

  const rows: ChartRow[] = []
  let cumulativePaid = 0
  for (let month = 1; month <= lastMonth; month++) {
    cumulativePaid += paymentByMonth.get(month)?.amountPaid ?? 0
    const received =
      chit.receivedMonth != null && month >= chit.receivedMonth
        ? (chit.receivedAmount ?? 0)
        : 0
    rows.push({ month, paid: cumulativePaid, received })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paid in vs received</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-60 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rows}
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `M${value}`}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(value) => compactInr(Number(value))}
              />
              <Tooltip
                formatter={(value, name) => [formatPaise(Number(value)), name]}
                labelFormatter={(label) =>
                  `Month ${label} · ${formatMonthYear(dateForMonth(chit.startDate, Number(label)))}`
                }
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  color: 'hsl(var(--popover-foreground))',
                }}
                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
              />
              <Legend />
              <Line
                type="linear"
                dataKey="paid"
                name="Paid in"
                stroke="#e11d48"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="linear"
                dataKey="received"
                name="Received"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Total paid so far versus what you’ve received. When the green line
          rises above the red, you’re in profit.
        </p>
      </CardContent>
    </Card>
  )
}
