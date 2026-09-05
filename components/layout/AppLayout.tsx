import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { ProjectDetailDrawer } from '@/components/projects/ProjectDetailDrawer';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { InviteMemberModal } from '@/components/users/InviteMemberModal';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  activeView: 'dashboard' | 'kanban' | 'list' | 'analytics' | 'projects' | 'members';
}

const BREADCRUMBS: Record<string, { label: string; sub?: string }> = {
  dashboard: { label: 'Dashboard' },
  kanban: { label: 'Task Board' },
  list: { label: 'Task Board', sub: 'List View' },
  members: { label: 'Team Members' },
  analytics: { label: 'Analytics' },
  projects: { label: 'Projects' },
};

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  title = 'TaskFlow | High-Performance Team Workspace',
  activeView,
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated' && router.isReady) {
      router.replace('/auth/signin');
    }
  }, [status, router.isReady, router]);

  // Close mobile nav on route change
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, []);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-full border-3 border-slate-200 border-t-indigo-600 animate-spin" />
          <span className="text-xs text-slate-500 font-bold tracking-wide">
            {status === 'loading' ? 'Loading TaskFlow...' : 'Redirecting to Sign In...'}
          </span>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta
          name="description"
          content="Modern engineering task board, kanban, workload distribution, and audit engine."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="app-layout">
        {/* Sidebar with Desktop Fixed & Mobile Drawer Modes */}
        <Sidebar
          activeView={activeView}
          isMobileOpen={isMobileNavOpen}
          onMobileClose={() => setIsMobileNavOpen(false)}
        />

        {/* Main Content */}
        <div className="main-content">
          {/* Top Bar with Mobile Menu Toggle */}
          <TopBar
            activeView={activeView}
            breadcrumb={BREADCRUMBS[activeView]}
            onMenuClick={() => setIsMobileNavOpen(true)}
          />

          {/* Page Content with Fluid Responsive Padding */}
          <main className="content-scroll">
            <div className="p-3 sm:p-5 md:p-6 max-w-full">{children}</div>
          </main>
        </div>

        {/* Global Modals & Drawers */}
        <CreateTaskModal />
        <CreateProjectModal />
        <InviteMemberModal />
        <TaskDetailDrawer />
        <ProjectDetailDrawer />
      </div>
    </>
  );
};
