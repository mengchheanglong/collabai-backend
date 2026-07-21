// src/modules/tasks/domain/entities/subtask.entity.ts
//
// A checklist item belonging to a Task (part of the Task aggregate). Maps to the Prisma
// `Subtask` model (`completed`→done, `orderIndex` for ordering).

export interface SubtaskProps {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  completedAt: Date | null;
  orderIndex: number;
}

export interface CreateSubtaskProps {
  id: string;
  taskId: string;
  title: string;
  orderIndex: number;
}

export class SubtaskEntity {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  completedAt: Date | null;
  orderIndex: number;

  private constructor(props: SubtaskProps) {
    this.id = props.id;
    this.taskId = props.taskId;
    this.title = props.title;
    this.done = props.done;
    this.completedAt = props.completedAt;
    this.orderIndex = props.orderIndex;
  }

  static create(props: CreateSubtaskProps): SubtaskEntity {
    return new SubtaskEntity({
      id: props.id,
      taskId: props.taskId,
      title: props.title.trim(),
      done: false,
      completedAt: null,
      orderIndex: props.orderIndex,
    });
  }

  static fromPersistence(props: SubtaskProps): SubtaskEntity {
    return new SubtaskEntity(props);
  }

  setDone(done: boolean): void {
    this.done = done;
    this.completedAt = done ? new Date() : null;
  }

  rename(title: string): void {
    this.title = title.trim();
  }
}
