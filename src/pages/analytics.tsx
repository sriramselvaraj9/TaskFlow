import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { AppLayout } from '@/components/layout/AppLayout';

export default function AnalyticsPage() {
  return (
    <AppLayout activeView="analytics" title="Analytics & Telemetry | TaskFlow">
      <AnalyticsView />
    </AppLayout>
  );
}
