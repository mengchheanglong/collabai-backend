// src/modules/ai/infrastructure/providers/stub-ai.provider.ts
//
// Deterministic, network-free AI provider. Used when OPENAI_API_KEY is unset (dev without
// a key) and as the default in tests. It produces plausible, rule-based output so the
// endpoints work end-to-end without any external dependency.

import {
  GenerateDescriptionInput,
  GenerateTasksInput,
  IAiProvider,
  StructuredTask,
  SuggestSubtasksInput,
  SummarizeCommentsInput,
  TaskSearchInterpretation,
  ProjectInsightsInput,
  ProjectRecommendation,
  TaskActionContext,
  ProposedTaskAction,
} from '../../domain/services/ai-provider.interface';

export class StubAiProvider implements IAiProvider {
  async proposeTaskActions(input: TaskActionContext): Promise<{ actions: ProposedTaskAction[]; source: 'fallback' }> {
    const request = input.request.toLowerCase();
    const target = input.tasks.find((task) => request.includes(task.title.toLowerCase()))
      ?? input.tasks.find((task) => task.status !== 'done' && task.dueDate && new Date(task.dueDate) < new Date())
      ?? input.tasks.find((task) => task.status !== 'done');
    if (!target) return { actions: [], source: 'fallback' };
    const changes: ProposedTaskAction['changes'] = {};
    if (/\b(done|complete|completed|finish)\b/.test(request) && target.status !== 'done') changes.status = 'done';
    if (/\b(start|in progress)\b/.test(request) && target.status !== 'in_progress') changes.status = 'in_progress';
    const priority = request.match(/\b(low|medium|high|urgent)\s+priority\b|\bpriority\s+(low|medium|high|urgent)\b/);
    const requestedPriority = priority?.[1] ?? priority?.[2];
    if (requestedPriority && requestedPriority !== target.priority) changes.priority = requestedPriority;
    if (!Object.keys(changes).length && /\b(priority|prioritize|urgent)\b/.test(request)) {
      const nextPriority = target.priority === 'low' ? 'medium' : target.priority === 'medium' ? 'high' : target.priority === 'high' ? 'urgent' : null;
      if (nextPriority) changes.priority = nextPriority;
    }
    return Object.keys(changes).length
      ? { actions: [{ taskId: target.id, rationale: 'Development fallback selected a candidate from the supplied request and task state. Review before applying.', changes }], source: 'fallback' }
      : { actions: [], source: 'fallback' };
  }

  /** Deterministic, explicitly non-LLM fallback for local development without a provider key. */
  async recommendProjectActions(input: ProjectInsightsInput): Promise<{ recommendations: ProjectRecommendation[]; source: 'fallback' }> {
    const results: ProjectRecommendation[] = [];
    const overdue = input.tasks.filter((task) => task.status !== 'done' && task.dueDate && new Date(task.dueDate) < new Date());
    if (overdue.length) results.push({
      title: `Review ${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`,
      rationale: `These open tasks are past their due dates: ${overdue.slice(0, 3).map((task) => task.title).join(', ')}.`,
      urgency: 'high', action: 'review_task', taskIds: overdue.slice(0, 3).map((task) => task.id),
    });
    const workload = [...input.workload].sort((a, b) => b.openTasks - a.openTasks);
    if (workload.length > 1 && workload[0].openTasks - workload[workload.length - 1].openTasks >= 3) results.push({
      title: 'Check whether work can be rebalanced',
      rationale: `${workload[0].member} has ${workload[0].openTasks} open tasks while ${workload[workload.length - 1].member} has ${workload[workload.length - 1].openTasks}.`,
      urgency: 'medium', action: 'balance_workload', taskIds: [],
    });
    if (input.metrics.completedLast14Days < input.metrics.completedPrevious14Days) results.push({
      title: 'Review the recent delivery slowdown',
      rationale: `The team completed ${input.metrics.completedLast14Days} tasks in the last 14 days versus ${input.metrics.completedPrevious14Days} in the prior 14 days.`,
      urgency: 'medium', action: 'plan', taskIds: [],
    });
    if (!results.length && input.tasks.length) {
      const candidates = [...input.tasks].filter((task) => task.status !== 'done').sort((a, b) => (b.openSubtasks - a.openSubtasks) || (b.priority === 'urgent' ? 1 : 0) - (a.priority === 'urgent' ? 1 : 0)).slice(0, 2);
      results.push({ title: 'Confirm the next delivery targets', rationale: `Review ${candidates.map((task) => task.title).join(' and ')} against the current project plan.`, urgency: 'low', action: 'review_task', taskIds: candidates.map((task) => task.id) });
    }
    return { recommendations: results.slice(0, 5), source: 'fallback' };
  }

  async generateTasks(input: GenerateTasksInput): Promise<StructuredTask[]> {
    const count = Math.min(Math.max(input.count, 1), 15);
    const results: StructuredTask[] = [];
    for (let i = 1; i <= count; i++) {
      results.push({
        title: `Task ${i}: ${input.prompt.slice(0, 60)}`,
        description: `Execute part ${i} for "${input.prompt}": define objectives, methodology, and outcome measures.`,
        subtasks: [
          `Prepare materials and setup for phase ${i}`,
          `Execute step ${i} procedures`,
          `Record outcomes and observations`,
          `Review findings and finalize phase ${i}`,
        ],
        priority: i === 1 ? 'high' : 'medium',
        labels: ['plan', 'ai-generated'],
      });
    }
    return results;
  }
  async suggestSubtasks(input: SuggestSubtasksInput): Promise<string[]> {
    const base = [
      `Break down "${input.title}" into concrete steps`,
      `Draft the approach for ${input.title}`,
      `Implement the core of ${input.title}`,
      `Write tests for ${input.title}`,
      `Review and refine ${input.title}`,
      `Document ${input.title}`,
      `Verify ${input.title} end-to-end`,
    ];
    return base.slice(0, Math.min(input.count, base.length));
  }

  async generateDescription(input: GenerateDescriptionInput): Promise<string> {
    switch (input.mode) {
      case 'improve':
        return `${(input.currentDescription ?? '').trim()} (clarified: goals, acceptance criteria, and edge cases for "${input.title}".)`.trim();
      case 'shorten':
        return (input.currentDescription ?? input.title)
          .split('.')
          .slice(0, 1)
          .join('.')
          .trim();
      case 'generate':
      default:
        return `Complete "${input.title}": define the outcome, list the steps, and note acceptance criteria.`;
    }
  }

  async summarizeComments(input: SummarizeCommentsInput): Promise<string> {
    const n = input.comments.length;
    if (n === 0) return 'No comments to summarize yet.';
    const first = input.comments[0].slice(0, 140);
    return `Summary of ${n} comment${n === 1 ? '' : 's'}: ${first}${first.length >= 140 ? '…' : ''}`;
  }

  async interpretSearch(query: string): Promise<TaskSearchInterpretation> {
    const lower = query.toLowerCase();

    let status: TaskSearchInterpretation['status'];
    if (lower.includes('in progress') || lower.includes('in-progress')) {
      status = 'in_progress';
    } else if (lower.includes('done') || lower.includes('completed')) {
      status = 'done';
    } else if (lower.includes('todo') || lower.includes('to do')) {
      status = 'todo';
    }

    let dueBefore: Date | undefined;
    const now = new Date();
    if (lower.includes('today')) {
      dueBefore = endOfDay(now);
    } else if (lower.includes('tomorrow')) {
      dueBefore = endOfDay(addDays(now, 1));
    } else if (lower.includes('this week')) {
      dueBefore = endOfDay(addDays(now, 7));
    }

    // With no NL model, use the raw text as a title search unless a status was detected.
    const q = status ? undefined : query.trim() || undefined;

    return {
      q,
      status,
      dueBefore,
      raw: {
        originalQuery: query,
        detectedStatus: status ?? null,
        dueBefore: dueBefore ? dueBefore.toISOString() : null,
      },
    };
  }

  async chat(input: {
    message: string;
    context?: {
      projectName?: string;
      projectDescription?: string;
      tasksSummary?: string;
      membersSummary?: string;
    };
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<string> {
    const msg = input.message.toLowerCase();
    const proj = input.context?.projectName ?? 'your project';

    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
      return `Hello! I'm CollabAI. How can I help you manage **${proj}** today? You can ask me to create tasks, update priorities, assign work, or brainstorm project ideas.`;
    }
    if (msg.includes('how are you')) {
      return `I'm doing great and ready to assist you with **${proj}**! What would you like to work on next?`;
    }
    if (
      msg.includes('summary') ||
      msg.includes('status') ||
      msg.includes('progress')
    ) {
      if (input.context?.tasksSummary) {
        return `### 📋 Project Overview for **${proj}**\n\n${input.context.tasksSummary}\n\nLet me know if you want to organize, prioritize, or assign any of these tasks!`;
      }
      return `Here to help track **${proj}**. Let me know what specific tasks or team members you'd like to check on.`;
    }
    if (msg.includes('help') || msg.includes('what can you do')) {
      return `I can help you:\n- **Manage tasks**: create, assign, change status/priority, and set due dates.\n- **Brainstorm**: generate structured task lists and breakdown complex goals.\n- **Search & Filter**: find specific tasks and filter your board.\n- **Collaborate**: post comments and summarize team discussions.\n\nYou can talk to me naturally (e.g. *"create a task for Sunday outing"*, *"set priority to high and assign it to Mengchheang"*), or use slash commands like \`/create\`, \`/task\`, and \`/filter\`.`;
    }
    return `I understand you're asking about "${input.message}". For **${proj}**, I can assist with planning, task updates, role assignments, and team coordination. How would you like to proceed?`;
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
