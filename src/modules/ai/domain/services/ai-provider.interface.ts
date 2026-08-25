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

export interface ChatContext {
  projectName?: string;
  projectDescription?: string;
  tasksSummary?: string;
  membersSummary?: string;
}

export interface ChatInput {
  message: string;
  context?: ChatContext;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface IAiProvider {
  suggestSubtasks(input: SuggestSubtasksInput): Promise<string[]>;
  generateDescription(input: GenerateDescriptionInput): Promise<string>;
  summarizeComments(input: SummarizeCommentsInput): Promise<string>;
  interpretSearch(query: string): Promise<TaskSearchInterpretation>;
  generateTasks(input: GenerateTasksInput): Promise<StructuredTask[]>;
  chat(input: ChatInput): Promise<string>;
}
