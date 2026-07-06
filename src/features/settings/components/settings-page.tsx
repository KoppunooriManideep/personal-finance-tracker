import { PageHeader } from '@/components/common/page-header'
import { InviteManager } from '@/features/family/components/invite-manager'
import { LeaveFamilyCard } from '@/features/family/components/leave-family-card'
import { FamilyMembersCard } from '@/features/settings/components/family-members-card'
import { PreferencesCard } from '@/features/settings/components/preferences-card'
import { ProfileCard } from '@/features/settings/components/profile-card'

/** Profile, family management and local preferences. */
export function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Settings"
        description="Profile, family members, invite codes and preferences."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <ProfileCard />
          <FamilyMembersCard />
          <InviteManager />
        </div>
        <div className="space-y-6">
          <PreferencesCard />
          <LeaveFamilyCard />
        </div>
      </div>
    </div>
  )
}
