import { useState } from 'react'
import { Globe, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPaise, paiseToRupees, rupeesToPaise } from '@/lib/money'
import { formatDateTime } from '@/lib/date'
import { useSetGoldSpot } from '@/features/investments/hooks/use-gold-mutations'
import { fetchLiveGoldRate } from '@/features/investments/api/gold-rate-api'
import type { GoldSpot } from '@/features/investments/api/gold-queries'

interface GoldSpotEditorProps {
  spot: GoldSpot | null
  canManage: boolean
}

/**
 * Shows the family's current 24K (999) gold rate and lets an editor update it.
 * A later phase will refresh this automatically (e.g. from GoodReturns).
 */
export function GoldSpotEditor({ spot, canManage }: GoldSpotEditorProps) {
  const setSpot = useSetGoldSpot()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [fetching, setFetching] = useState(false)

  const fetchLive = async () => {
    setFetching(true)
    try {
      const live = await fetchLiveGoldRate()
      await setSpot.mutateAsync({
        pricePaisePerGram: live.rate24kPaise,
        source: live.source,
      })
      toast.success(
        `Rate updated · ${formatPaise(live.rate24kPaise, { decimals: false })}/g (24K)`,
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not fetch the live rate',
      )
      console.error(error)
    } finally {
      setFetching(false)
    }
  }

  const startEditing = () => {
    setValue(spot ? String(paiseToRupees(spot.pricePaisePerGram)) : '')
    setEditing(true)
  }

  const save = async () => {
    const rupees = Number(value)
    if (value.trim() === '' || !Number.isFinite(rupees) || rupees <= 0) {
      toast.error('Enter a valid rate')
      return
    }
    try {
      await setSpot.mutateAsync({
        pricePaisePerGram: rupeesToPaise(rupees),
        source: 'Manual',
      })
      toast.success('Gold rate updated')
      setEditing(false)
    } catch (error) {
      toast.error('Could not update the rate')
      console.error(error)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">Gold rate · 24K (999)</p>
          {spot ? (
            <>
              <p className="text-xl font-semibold tabular-nums">
                {formatPaise(spot.pricePaisePerGram, { decimals: false })}
                <span className="text-muted-foreground text-sm font-normal">
                  {' '}
                  / g
                </span>
              </p>
              <p className="text-muted-foreground text-xs">
                Updated {formatDateTime(spot.asOf)}
                {spot.source ? ` · ${spot.source}` : ''}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Not set — add today’s rate to value your holdings.
            </p>
          )}
        </div>

        {canManage ? (
          editing ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                autoFocus
                placeholder="₹ / gram"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && save()}
                className="w-32"
              />
              <Button size="sm" onClick={save} disabled={setSpot.isPending}>
                {setSpot.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={setSpot.isPending}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={fetchLive} disabled={fetching}>
                {fetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                Live rate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={startEditing}
                disabled={fetching}
              >
                <RefreshCw className="h-4 w-4" />
                {spot ? 'Manual' : 'Set manually'}
              </Button>
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  )
}
