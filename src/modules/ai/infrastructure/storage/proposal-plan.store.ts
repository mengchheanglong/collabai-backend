// src/modules/ai/infrastructure/storage/proposal-plan.store.ts

export interface AiTaskAction {
  id: string;
  taskId: string;
  taskTitle: string;
  rationale: string;
  previous: {
    status: string;
    priority: string;
    assigneeId: string | null;
    dueDate: string | null;
  };
  changes: {
    status?: string;
    priority?: string;
    assigneeId?: string | null;
    dueDate?: string | null;
  };
}

export interface AiTaskActionPlan {
  id: string;
  projectId: string;
  request: string;
  actions: AiTaskAction[];
  source: 'ai' | 'fallback';
  status: 'pending' | 'applied';
  expiresAt: string;
}

/** In-memory store fallback and test harness for action proposal plans. */
export const proposalPlanStore = new Map<string, AiTaskActionPlan>();
