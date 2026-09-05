import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectsView } from '@/components/projects/ProjectsView';

//Projects page (shows list of all projects).
export default function ProjectsPage() {
  return (
    <AppLayout activeView="projects" title="Projects | TaskFlow">
      <ProjectsView />
    </AppLayout>
  );
}
