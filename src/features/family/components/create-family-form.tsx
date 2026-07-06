import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { paths } from '@/config/paths'
import { useCreateFamily } from '@/features/family/hooks/use-create-family'
import {
  createFamilySchema,
  type CreateFamilyValues,
} from '@/features/family/schema'

/** Form to create a new family. The creator becomes the owner. */
export function CreateFamilyForm() {
  const navigate = useNavigate()
  const createFamily = useCreateFamily()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateFamilyValues>({
    resolver: zodResolver(createFamilySchema),
    defaultValues: { name: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createFamily.mutateAsync(values.name)
      toast.success('Family created')
      navigate(paths.dashboard, { replace: true })
    } catch (error) {
      toast.error('Could not create family. Please try again.')
      console.error(error)
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5 text-left">
        <Label htmlFor="family-name">Family name</Label>
        <Input
          id="family-name"
          placeholder="e.g. Sharma Family"
          autoComplete="off"
          {...register('name')}
        />
        {errors.name ? (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={createFamily.isPending}>
        {createFamily.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : null}
        Create family
      </Button>
    </form>
  )
}
