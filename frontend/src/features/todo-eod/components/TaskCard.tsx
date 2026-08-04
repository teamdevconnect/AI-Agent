import { Draggable } from '@hello-pangea/dnd';
import clsx from 'clsx';
import { Badge } from '@/components/ui';
import type { TodoTask, TaskPriority } from '@/services/todoEodService';
import styles from './TaskCard.module.css';

export const PRIORITY_VARIANT: Record<TaskPriority, 'danger' | 'warning' | 'accent' | 'neutral'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'accent',
  low: 'neutral',
};

export function TaskCard({ task, index }: { task: TodoTask; index: number }) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={clsx(styles.card, snapshot.isDragging && styles.dragging)}
        >
          <span className={styles.title}>{task.title}</span>
          <div className={styles.meta}>
            <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
            {task.isOverdue && <Badge variant="danger">Overdue</Badge>}
            {task.category && <span className={styles.category}>{task.category}</span>}
          </div>
        </div>
      )}
    </Draggable>
  );
}
