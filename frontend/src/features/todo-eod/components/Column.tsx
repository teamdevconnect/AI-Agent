import { Droppable } from '@hello-pangea/dnd';
import clsx from 'clsx';
import type { TodoTask, TaskStatus } from '@/services/todoEodService';
import { TaskCard } from './TaskCard';
import styles from './Column.module.css';

export function Column({ status, label, tasks }: { status: TaskStatus; label: string; tasks: TodoTask[] }) {
  return (
    <div className={styles.column}>
      <div className={styles.header}>
        <span className={styles.title}>
          {label} ({tasks.length})
        </span>
      </div>
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={clsx(styles.dropArea, snapshot.isDraggingOver && styles.dropAreaOver)}
          >
            {tasks.length === 0 && !snapshot.isDraggingOver && <div className={styles.empty}>No tasks</div>}
            {tasks.map((task, i) => (
              <TaskCard key={task.id} task={task} index={i} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
