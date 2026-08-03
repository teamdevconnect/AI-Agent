import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import { Skeleton } from '@/components/ui';
import { extractErrorMessage } from '@/utils/errors';
import { todoEodService, type TaskStatus, type TodoTask, type ListTasksParams } from '@/services/todoEodService';
import { classifyTaskSource, type TaskSource } from '../utils/taskSource';
import { Column } from './Column';
import styles from './Board.module.css';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'done', label: 'Done' },
];

export function Board({ params, sourceFilter = 'all' }: { params: ListTasksParams; sourceFilter?: TaskSource | 'all' }) {
  const queryClient = useQueryClient();
  const queryKey = ['tasks', params];

  const { data: allTasks, isLoading } = useQuery({
    queryKey,
    queryFn: () => todoEodService.getTasks(params),
  });

  const tasks = sourceFilter === 'all' ? allTasks : allTasks?.filter((t) => classifyTaskSource(t) === sourceFilter);

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => todoEodService.updateTaskStatus(id, status),
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !allTasks) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as TaskStatus;
    const previous = allTasks;

    queryClient.setQueryData<TodoTask[]>(queryKey, (old) =>
      (old ?? []).map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    mutation.mutate(
      { id: taskId, status: newStatus },
      {
        onError: (err) => {
          queryClient.setQueryData(queryKey, previous);
          toast.error(extractErrorMessage(err));
        },
      },
    );
  };

  if (isLoading || !tasks) {
    return <Skeleton height={300} />;
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className={styles.board}>
        {COLUMNS.map((col) => (
          <Column key={col.status} status={col.status} label={col.label} tasks={tasks.filter((t) => t.status === col.status)} />
        ))}
      </div>
    </DragDropContext>
  );
}
