import { AppLayout } from '@/components/layout/AppLayout';
import { TeamMembersView } from '@/components/members/TeamMembersView';

//Members page.
export default function TeamMembersPage() {
  return (
    <AppLayout activeView="members" title="Team Members | TaskFlow">
      <TeamMembersView />
    </AppLayout>
  );
}
