import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { AppLayout } from '@/components/layout/AppLayout';
import { TaskBoardHeader } from '@/components/tasks/TaskBoardHeader';
import { TaskListView } from '@/components/tasks/TaskListView';
import { useTasksQuery } from '@/hooks/useTasks';
import { useTaskStore } from '@/store/useTaskStore';

export default function TasksPage() {
  const { data: session } = useSession();
  const [taskView, setTaskView] = useState<'kanban' | 'list'>('kanban');

  const {
    selectedProjectId,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    onlyMyTasks,
    searchQuery,
  } = useTaskStore();

  const { data: rawTasks = [], isLoading: isTasksLoading } = useTasksQuery({
    projectId: selectedProjectId,
    status: statusFilter,
    priority: priorityFilter,
    assigneeId: assigneeFilter,
    search: searchQuery,
  });

  // Apply My Tasks filter if enabled
  const tasks = onlyMyTasks ? rawTasks.filter((t) => t.assigneeId === session?.user?.id) : rawTasks;

  return (
    <AppLayout activeView={taskView} title="Task Board | TaskFlow">
      <TaskBoardHeader
        activeView={taskView}
        onViewChange={(v) => setTaskView(v as 'kanban' | 'list')}
        totalTasksCount={tasks.length}
      />
      {taskView === 'kanban' && <KanbanBoard tasks={tasks} isLoading={isTasksLoading} />}
      {taskView === 'list' && <TaskListView tasks={tasks} isLoading={isTasksLoading} />}
    </AppLayout>
  );
}
