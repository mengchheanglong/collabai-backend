# Shared TypeScript DTO Types

Copy these types into frontend `src/app/shared/models/api.types.ts` and backend DTO files when implementation begins.

```ts
export type ObjectIdString = string;
export type ISODateString = string;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  error: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field?: string; message: string }>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UserDto {
  _id: ObjectIdString;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface ProjectMemberDto {
  userId: ObjectIdString;
  role: ProjectRole;
  name: string;
  email: string;
  avatarUrl?: string | null;
  joinedAt?: ISODateString;
}

export interface ProjectDto {
  _id: ObjectIdString;
  name: string;
  description?: string;
  color?: string;
  ownerId: ObjectIdString;
  members: ProjectMemberDto[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface BoardColumnDto {
  key: TaskStatus | string;
  title: string;
  position: number;
}

export interface BoardDto {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  name: string;
  description?: string;
  columns: BoardColumnDto[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SubtaskDto {
  _id: string;
  title: string;
  done: boolean;
}

export interface TaskDto {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  boardId: ObjectIdString;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  assigneeId?: ObjectIdString | null;
  createdById: ObjectIdString;
  dueDate?: ISODateString | null;
  labels: string[];
  subtasks: SubtaskDto[];
  commentCount?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CommentDto {
  _id: ObjectIdString;
  taskId: ObjectIdString;
  projectId: ObjectIdString;
  authorId: ObjectIdString;
  author: Pick<UserDto, '_id' | 'name' | 'email' | 'avatarUrl'>;
  body: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ActivityDto {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  actorId: ObjectIdString;
  actor?: Pick<UserDto, '_id' | 'name' | 'email' | 'avatarUrl'>;
  type: string;
  entityType: 'project' | 'board' | 'task' | 'comment' | 'member' | 'ai';
  entityId?: ObjectIdString | string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: ISODateString;
}

export interface NotificationDto {
  _id: ObjectIdString;
  userId: ObjectIdString;
  projectId?: ObjectIdString;
  taskId?: ObjectIdString;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: ISODateString;
}

export interface AuthResponseDto {
  accessToken: string;
  user: UserDto;
}

export interface AnalyticsSummaryDto {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  overdueTasks: number;
  completionRate: number;
  tasksByUser: Array<{ userId: ObjectIdString; name: string; total: number; done: number }>;
  tasksByPriority: Record<TaskPriority, number>;
}

export interface BurndownPointDto {
  date: string;
  remainingTasks: number;
  completedTasks: number;
}
```

## Request body types

```ts
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface CreateTaskRequest {
  projectId: ObjectIdString;
  boardId: ObjectIdString;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: ObjectIdString | null;
  dueDate?: ISODateString | null;
  labels?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: ObjectIdString | null;
  dueDate?: ISODateString | null;
  labels?: string[];
  subtasks?: SubtaskDto[];
}

export interface MoveTaskRequest {
  status: TaskStatus;
  position: number;
}

export interface CreateCommentRequest {
  body: string;
}

export interface AiSubtasksRequest {
  projectId?: ObjectIdString;
  title: string;
  description?: string;
  count?: number;
}

export interface AiDescriptionRequest {
  projectId?: ObjectIdString;
  title: string;
  mode: 'generate' | 'improve' | 'shorten';
  currentDescription?: string;
}
```

