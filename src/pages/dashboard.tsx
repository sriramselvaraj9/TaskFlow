import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { AppLayout } from '@/components/layout/AppLayout';

//Dashboard page (shows overview of all projects and tasks).
export default function DashboardPage() {
  return (
    <AppLayout activeView="dashboard" title="Dashboard | TaskFlow">
      <DashboardOverview />
    </AppLayout>
  );
}
