import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { paths } from '@/config/paths'
import { useJoinFamily } from '@/features/family/hooks/use-join-family'
import {
  joinFamilySchema,
  type JoinFamilyValues,
} from '@/features/family/schema'

/** Form to join an existing family using an invite code. */
export function JoinFamilyForm() {
  const navigate = useNavigate()
  const joinFamily = useJoinFamily()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinFamilyValues>({
    resolver: zodResolver(joinFamilySchema),
    defaultValues: { code: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await joinFamily.mutateAsync(values.code)
      toast.success('Joined family')
      navigate(paths.dashboard, { replace: true })
    } catch (error) {
      // The RPC raises a friendly message for invalid/expired codes.
      const message =
        error instanceof Error ? error.message : 'Could not join family'
      toast.error(message)
      console.error(error)
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5 text-left">
        <Label htmlFor="invite-code">Invite code</Label>
        <Input
          id="invite-code"
          placeholder="e.g. A3F9C2D1"
          autoComplete="off"
          className="uppercase"
          {...register('code')}
        />
        {errors.code ? (
          <p className="text-destructive text-sm">{errors.code.message}</p>
        ) : null}
      </div>
      <Button
        type="submit"
        variant="secondary"
        className="w-full"
        disabled={joinFamily.isPending}
      >
        {joinFamily.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : null}
        Join family
      </Button>
    </form>
  )
}
