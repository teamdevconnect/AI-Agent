import { IsIn } from 'class-validator';

export class UpdateTaskStatusDto {
  @IsIn(['todo', 'in_progress', 'done'])
  status: 'todo' | 'in_progress' | 'done';
}
