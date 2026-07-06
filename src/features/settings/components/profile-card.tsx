import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { useFamilyMembers } from '@/features/family/hooks/use-family-members'
import { useUpdateOwnFamilyDisplayName } from '@/features/family/hooks/use-family-member-mutations'

/** Google profile plus editable family display name. */
export function ProfileCard() {
  const { user } = useAuth()
  const { data: members } = useFamilyMembers()
  const updateDisplayName = useUpdateOwnFamilyDisplayName()

  const googleName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    'Profile'
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const currentMember = members?.find((member) => member.userId === user?.id)
  const loadedDisplayName = currentMember?.displayName ?? googleName
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null)
  const displayName = displayNameDraft ?? loadedDisplayName

  const handleSave = async () => {
    const next = displayName.trim()
    if (!next) {
      toast.error('Name cannot be empty')
      return
    }

    try {
      await updateDisplayName.mutateAsync(next)
      setDisplayNameDraft(null)
      toast.success('Profile updated')
    } catch (error) {
      toast.error('Could not update profile')
      console.error(error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
        <CardDescription>Your Google account details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={avatarUrl} alt={googleName} />
            <AvatarFallback>{getInitials(googleName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{googleName}</p>
            <p className="text-muted-foreground truncate text-sm">
              {user?.email}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-display-name">Family display name</Label>
          <div className="flex gap-2">
            <Input
              id="profile-display-name"
              value={displayName}
              onChange={(event) => setDisplayNameDraft(event.target.value)}
              autoComplete="name"
            />
            <Button
              onClick={handleSave}
              disabled={updateDisplayName.isPending}
            >
              {updateDisplayName.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return value.slice(0, 2).toUpperCase()
}
