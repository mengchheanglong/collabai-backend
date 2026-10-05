// src/modules/ai/domain/services/ai-provider.interface.ts
//
// Port for the AI provider. The application layer depends only on this interface; a
// concrete provider (OpenAI, or a deterministic stub) is bound to AI_PROVIDER in the
// module. Keeping this a port means the provider is swappable and mockable in tests, and
// the rest of the module never imports a vendor SDK.

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type DescriptionMode = 'generate' | 'improve' | 'shorten';

export interface SuggestSubtasksInput {
  title: string;
  description?: string;
  count: number;
}

export interface GenerateDescriptionInput {
  title: string;
  mode: DescriptionMode;
  currentDescription?: string;
}

export interface SummarizeCommentsInput {
  taskTitle?: string;
  comments: string[];
}

/** Structured filter the provider derives from a natural-language task query. */
export interface TaskSearchInterpretation {
  q?: string;
  status?: 'todo' | 'in_progress' | 'done';
  label?: string;
  dueBefore?: Date;
  /** Raw interpretation echoed back to the client for transparency/debugging. */
  raw: Record<string, unknown>;
}

export interface StructuredTask {
  title: string;
  description: string;
  subtasks: string[];
  status?: 'todo' | 'in_progress' | 'done';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  labels?: string[];
  dueDate?: string;
}

export interface GenerateTasksInput {
  prompt: string;
  count: number;
}

export interface ChatDocumentContext {
  id: string;
  title: string;
  content: string;
  fileType?: string | null;
  updatedAt?: Date;
}

export interface ChatContext {
  projectName?: string;
  projectDescription?: string;
  tasksSummary?: string;
  membersSummary?: string;
  documentsSummary?: string;
  documents?: ChatDocumentContext[];
}

export interface ChatInput {
  message: string;
  context?: ChatContext;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ProjectInsightsInput {
  projectName: string;
  projectDescription?: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  overdueTasks: Array<{
    title: string;
    priority: string;
    dueDate?: string | null;
    assignee?: string | null;
  }>;
  upcomingTasks: Array<{
    title: string;
    priority: string;
    dueDate?: string | null;
    assignee?: string | null;
  }>;
  assigneeWorkload?: Array<{
    name: string;
    taskCount: number;
    overdueCount: number;
  }>;
}

export interface NextBestAction {
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  impact: string;
}

export interface ProjectInsightsOutput {
  healthScore: number; // 0 - 100
  status: 'on_track' | 'at_risk' | 'off_track';
  summary: string;
  risks: string[];
  recommendations: string[];
  nextBestActions: NextBestAction[];
}

export interface TaskActionProposalInput {
  request: string;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assigneeId: string | null;
    assigneeName?: string | null;
    dueDate?: string | null;
  }>;
  members: Array<{
    id: string;
    name: string;
  }>;
}

export interface ProposedAction {
  id: string;
  taskId: string;
  taskTitle: string;
  rationale: string;
  previous: { status: string; priority: string; assigneeId: string | null; dueDate: string | null };
  changes: { status?: string; priority?: string; assigneeId?: string | null; dueDate?: string | null };
}

export interface ProposeTaskActionsOutput {
  actions: ProposedAction[];
}

export interface IAiProvider {
  suggestSubtasks(input: SuggestSubtasksInput): Promise<string[]>;
  generateDescription(input: GenerateDescriptionInput): Promise<string>;
  summarizeComments(input: SummarizeCommentsInput): Promise<string>;
  interpretSearch(query: string): Promise<TaskSearchInterpretation>;
  generateTasks(input: GenerateTasksInput): Promise<StructuredTask[]>;
  chat(input: ChatInput): Promise<string>;
  generateProjectInsights(
    input: ProjectInsightsInput,
  ): Promise<ProjectInsightsOutput>;
  proposeTaskActions(
    input: TaskActionProposalInput,
  ): Promise<ProposeTaskActionsOutput>;
}
